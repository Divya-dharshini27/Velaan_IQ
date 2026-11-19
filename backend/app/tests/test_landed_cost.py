from decimal import Decimal as D

import pytest

from app.logic.landed_cost import (
    Incoterm, LandedCost, compare_routes, domestic_landed_cost,
    international_landed_cost, to_per_mt,
)

# shared fixture values: 520 USD/MT x 84 = 43,680.00 INR/MT
KW = dict(foreign_price_per_mt=D("520"), exchange_rate=D("84"),
          customs_duty_rate=D("0.05"), port_handling_per_mt=D("1000"),
          inland_transport_per_mt=D("1200"))


# ---- domestic ----
def test_domestic_total():
    r = domestic_landed_cost(D("45000"), D("800"), D("100"), D("150"))
    assert r.total_per_mt == D("46050.00")          # 45000 + 800 + 100 + 150
    assert r.is_complete


def test_domestic_missing_freight():
    r = domestic_landed_cost(D("45000"), None, D("100"))
    assert r.total_per_mt is None
    assert "freight_per_mt" in r.missing_inputs


# ---- currency conversion ----
def test_currency_conversion_exact():
    r = international_landed_cost(incoterm=Incoterm.CIF, **KW)
    assert r.components["commodity_cost"] == D("43680.00")          # 520 * 84


def test_currency_conversion_rounding():
    kw = {**KW, "exchange_rate": D("84.1234")}
    r = international_landed_cost(incoterm=Incoterm.CIF, **kw)
    assert r.components["commodity_cost"] == D("43744.17")          # 520 * 84.1234 = 43744.168


@pytest.mark.parametrize("rate", [D("0"), D("-84")])
def test_invalid_exchange_rate(rate):
    with pytest.raises(ValueError):
        international_landed_cost(incoterm=Incoterm.CIF, **{**KW, "exchange_rate": rate})


# ---- Incoterms and duplicate freight / insurance prevention ----
def test_fob_adds_freight_and_insurance():
    r = international_landed_cost(incoterm=Incoterm.FOB, freight_per_mt=D("2500"),
                                  insurance_per_mt=D("300"), **KW)
    # assessable = 43680 + 2500 + 300 = 46480 ; duty = 5% = 2324
    assert r.assessable_value_per_mt == D("46480.00")
    assert r.components["customs_duty"] == D("2324.00")
    # total = 43680 + 2500 + 300 + 2324 + 1000 + 1200
    assert r.total_per_mt == D("51004.00")


def test_cfr_does_not_double_count_freight():
    r = international_landed_cost(incoterm=Incoterm.CFR, freight_per_mt=D("2500"),
                                  insurance_per_mt=D("300"), **KW)
    # freight is already in the CFR price: ignored. assessable = 43680 + 300 = 43980 ; duty = 2199
    assert r.components["freight"] == D("0.00")
    assert r.total_per_mt == D("48379.00")          # 43680 + 300 + 2199 + 1000 + 1200
    assert any("freight" in n for n in r.notes)


def test_cif_does_not_double_count_freight_or_insurance():
    r = international_landed_cost(incoterm=Incoterm.CIF, freight_per_mt=D("2500"),
                                  insurance_per_mt=D("300"), **KW)
    assert r.components["freight"] == D("0.00")
    assert r.components["insurance"] == D("0.00")
    assert r.total_per_mt == D("48064.00")          # 43680 + 2184 (5% duty) + 1000 + 1200


def test_unsupported_incoterm_rejected():
    with pytest.raises(ValueError):
        Incoterm("EXW")


# ---- missing inputs ----
def test_fob_missing_freight():
    r = international_landed_cost(incoterm=Incoterm.FOB, insurance_per_mt=D("300"), **KW)
    assert r.total_per_mt is None
    assert "freight_per_mt" in r.missing_inputs


def test_missing_duty_rate_is_flagged_not_assumed():
    kw = {k: v for k, v in KW.items() if k != "customs_duty_rate"}
    r = international_landed_cost(incoterm=Incoterm.CIF, **kw)
    assert r.total_per_mt is None
    assert "customs_duty_rate" in r.missing_inputs


# ---- recoverable vs non-recoverable taxes ----
def test_recoverable_tax_excluded_from_cost():
    base = international_landed_cost(incoterm=Incoterm.FOB, freight_per_mt=D("2500"),
                                     insurance_per_mt=D("300"), **KW)
    with_taxes = international_landed_cost(
        incoterm=Incoterm.FOB, freight_per_mt=D("2500"), insurance_per_mt=D("300"),
        non_recoverable_tax_rate=D("0.02"), recoverable_tax_rate=D("0.18"), **KW)
    # tax base = 46480 + 2324 = 48804
    assert with_taxes.components["non_recoverable_taxes"] == D("976.08")        # 2% of 48804
    assert with_taxes.recoverable_taxes_excluded_per_mt == D("8784.72")         # 18% of 48804
    assert with_taxes.total_per_mt == base.total_per_mt + D("976.08")           # 51980.08


# ---- units ----
def test_unit_conversion():
    assert to_per_mt(D("4500"), "QUINTAL") == D("45000.00")
    assert to_per_mt(D("45"), "KG") == D("45000.00")
    assert to_per_mt(D("45000"), "MT") == D("45000.00")


def test_unknown_unit_rejected():
    with pytest.raises(ValueError):
        to_per_mt(D("20"), "BUSHEL")


# ---- comparison ----
def _dom():
    return domestic_landed_cost(D("45000"), D("800"), D("100"), D("150"))      # 46050


def test_domestic_cheaper():
    intl = international_landed_cost(incoterm=Incoterm.CIF, **KW)               # 48064
    c = compare_routes(_dom(), intl)
    assert c.cheaper_route == "DOMESTIC"
    assert c.difference_per_mt == D("2014.00")                                  # 48064 - 46050
    assert c.pct_difference_vs_domestic == D("4.37")                            # 2014 / 46050
    assert c.difference_below_tolerance is False


def test_international_cheaper():
    # 480 * 84 = 40320 ; duty 2016 ; + 1000 + 1200 = 44536
    intl = international_landed_cost(incoterm=Incoterm.CIF, **{**KW, "foreign_price_per_mt": D("480")})
    assert intl.total_per_mt == D("44536.00")
    c = compare_routes(_dom(), intl)
    assert c.cheaper_route == "INTERNATIONAL"
    assert c.difference_per_mt == D("-1514.00")                                 # 44536 - 46050
    assert c.pct_difference_vs_domestic == D("-3.29")


def test_small_difference_is_flagged():
    near = LandedCost("INTERNATIONAL", {}, D("46100.00"), [], [])
    c = compare_routes(_dom(), near)
    assert c.difference_below_tolerance is True                                 # 50 / 46050 = 0.11%


def test_comparison_not_possible_when_incomplete():
    bad = domestic_landed_cost(D("45000"), None, D("100"))
    intl = international_landed_cost(incoterm=Incoterm.CIF, **KW)
    c = compare_routes(bad, intl)
    assert c.cheaper_route is None
    assert not c.is_complete
    assert "domestic.freight_per_mt" in c.missing_inputs