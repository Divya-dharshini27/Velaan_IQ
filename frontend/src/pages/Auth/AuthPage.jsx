import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import BrandLogo from '../../components/common/BrandLogo';
import Button from '../../components/common/Button';
import { ShieldCheck, Sprout, TrendingUp, AlertCircle, Eye, EyeOff, Sparkles } from 'lucide-react';

export function AuthPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const { login, register, isAuthenticated, sessionExpiredMsg, clearSessionExpiredMsg } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectPath = location.state?.from?.pathname || '/dashboard';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectPath, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectPath]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!email.trim() || !password) {
      setFormError('Please enter both email and password.');
      return;
    }

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }

    if (isRegister && !fullName.trim()) {
      setFormError('Please enter your full name.');
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        await register(email.trim(), password, fullName.trim());
        toast.success('Account created successfully! Welcome to VELAAN IQ.');
      } else {
        await login(email.trim(), password);
        toast.success('Signed in successfully.');
      }
      clearSessionExpiredMsg();
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setFormError(err.message || 'Authentication failed. Please check your credentials.');
      toast.error(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setEmail('manager@velaan.ai');
    setPassword('Soybean2026!');
    setFormError('');
  };

  return (
    <div className="min-h-screen flex bg-soybean text-ink selection:bg-leaf selection:text-white">
      {/* Left side: Premium Agricultural Intelligence Brand Art */}
      <div className="hidden lg:flex lg:w-1/2 bg-forest relative overflow-hidden flex-col justify-between p-12 text-white bg-leaf-pattern">
        {/* Subtle decorative SVG overlay */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="leaf-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 40 M 0 0 L 40 40" fill="none" stroke="#FFFFFF" strokeWidth="0.5" />
                <circle cx="20" cy="20" r="3" fill="#D9A441" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#leaf-grid)" />
          </svg>
        </div>

        {/* Brand header */}
        <div className="relative z-10">
          <BrandLogo variant="dark" size="lg" showTagline={true} />
        </div>

        {/* Center feature highlights */}
        <div className="relative z-10 space-y-8 my-auto max-w-lg">
          <div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-gold/20 text-gold-light border border-gold/40">
              ABT-CPD Enterprise System
            </span>
            <h1 className="font-serif text-3xl xl:text-4xl font-bold mt-4 leading-tight">
              AI-assisted soybean procurement decision support
            </h1>
            <p className="text-stone-300 text-sm mt-3 leading-relaxed">
              Real-time inventory intelligence, landed cost analysis, and rule-based recommendations tailored for agro-commodity sourcing.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 pt-2">
            <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-forest-900/60 border border-forest-700/60 backdrop-blur-sm">
              <div className="w-10 h-10 rounded-xl bg-leaf/20 border border-leaf/40 flex items-center justify-center text-leaf-light flex-shrink-0">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-white">Three Critical Answers</h4>
                <p className="text-xs text-stone-300 mt-0.5">
                  1. WHEN should soybean be purchased? 2. HOW MUCH? 3. DOMESTIC or INTERNATIONAL?
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-forest-900/60 border border-forest-700/60 backdrop-blur-sm">
              <div className="w-10 h-10 rounded-xl bg-gold/20 border border-gold/40 flex items-center justify-center text-gold-light flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-gold" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-white">Landed Cost Optimization</h4>
                <p className="text-xs text-stone-300 mt-0.5">
                  Full domestic mandi vs international port landed cost breakdowns, freight, and duty simulations.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom footer text */}
        <div className="relative z-10 flex items-center justify-between text-xs text-forest-300 border-t border-forest-800/80 pt-6">
          <span>&copy; {new Date().getFullYear()} VELAAN IQ &bull; ABT-CPD</span>
          <span className="font-tamil text-forest-200">வேளாண் IQ கொள்முதல் நுண்ணறிவு</span>
        </div>
      </div>

      {/* Right side: Authentication Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile brand header */}
          <div className="lg:hidden mb-6 text-center flex justify-center">
            <BrandLogo variant="light" size="md" showTagline={true} />
          </div>

          {/* Session expired banner if applicable */}
          {sessionExpiredMsg && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Session expired</p>
                <p className="text-amber-800 mt-0.5">{sessionExpiredMsg}</p>
              </div>
            </div>
          )}

          {/* Form Header */}
          <div className="text-center sm:text-left">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-ink tracking-tight">
              {isRegister ? 'Create an Account' : 'Welcome back'}
            </h2>
            <p className="text-sm text-ink-muted mt-1.5">
              {isRegister
                ? 'Join VELAAN IQ to access soybean procurement intelligence'
                : 'Sign in to access your procurement dashboard and decisions'}
            </p>
          </div>

          {/* Error Message */}
          {formError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs sm:text-sm flex items-start gap-2.5 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{formError}</div>
            </div>
          )}

          {/* Main Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required={isRegister}
                  placeholder="e.g. Divya Dharshini"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-forest focus:border-transparent transition bg-white"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1.5">
                Work Email Address
              </label>
              <input
                type="email"
                required
                placeholder="name@velaan.ai"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-forest focus:border-transparent transition bg-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider">
                  Password
                </label>
                <span className="text-[11px] text-ink-muted">Min 8 characters</span>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-forest focus:border-transparent transition pr-10 bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full mt-2"
            >
              {isRegister ? 'Create Manager Account' : 'Sign In to VELAAN IQ'}
            </Button>
          </form>

          {/* Quick Demo Credentials Autofill */}
          {!isRegister && (
            <div className="p-3 rounded-xl bg-forest-50/70 border border-forest-100 flex items-center justify-between text-xs text-forest-800">
              <div>
                <span className="font-semibold block text-forest-900">Demo Account</span>
                <span className="text-[11px] text-forest-700 font-mono">manager@velaan.ai</span>
              </div>
              <button
                type="button"
                onClick={fillDemoCredentials}
                className="px-2.5 py-1 rounded-lg bg-white border border-forest-200 text-forest-800 font-medium hover:bg-forest-100 transition shadow-sm text-xs"
              >
                Auto-fill
              </button>
            </div>
          )}

          {/* Toggle between Login and Register */}
          <div className="text-center pt-2 border-t border-stone-200/80">
            <p className="text-xs text-ink-muted">
              {isRegister ? 'Already have an account?' : "Don't have an account yet?"}{' '}
              <button
                type="button"
                onClick={() => {
                  setIsRegister(!isRegister);
                  setFormError('');
                }}
                className="font-semibold text-forest hover:text-leaf underline transition"
              >
                {isRegister ? 'Sign In' : 'Register for access'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthPage;
