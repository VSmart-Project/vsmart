import { useState } from 'react';
import { Mail, Lock, KeyRound, ArrowRight } from 'lucide-react';
import { ShieldCheck, MapPinLine, Lightning } from '@phosphor-icons/react';
import { signIn, signUp, confirmSignUp, resendSignUpCode } from 'aws-amplify/auth';
import MapBackdrop, { PulseMarker } from '../marketing/MapBackdrop';

export default function AuthLayout({ onLoginSuccess, onBack }) {
    const [view, setView] = useState('login'); // 'login' | 'register' | 'otp'
    const [isLoading, setIsLoading] = useState(false);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const handleAction = async (e, action) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMsg('');

        try {
            if (action === 'login') {
                if (!email || !password) {
                    setErrorMsg('Please enter both email and password');
                    setIsLoading(false);
                    return;
                }
                await signIn({ username: email, password });
                onLoginSuccess();
            } else if (action === 'register') {
                if (password !== confirmPassword) {
                    setErrorMsg('Passwords do not match');
                    setIsLoading(false);
                    return;
                }
                await signUp({
                    username: email,
                    password,
                    options: { userAttributes: { email } }
                });
                setView('otp');
            } else if (action === 'otp') {
                await confirmSignUp({ username: email, confirmationCode: otpCode });
                setView('login');
            }
        } catch (err) {
            setErrorMsg(err.message || 'An error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendOTP = async () => {
        try {
            await resendSignUpCode({ username: email });
            setErrorMsg('');
            alert('Verification code resent successfully. Please check your email!');
        } catch (err) {
            setErrorMsg(err.message || 'Failed to resend code. Please try again.');
        }
    };

    return (
        <div className="h-screen w-screen flex flex-col md:flex-row bg-surface dark:bg-surface-dark overflow-hidden text-ink dark:text-ink-dark">

            {/* Left side: Branding */}
            <div className="hidden md:flex flex-col flex-1 p-10 lg:p-20 justify-center items-start relative overflow-hidden bg-card dark:bg-card-dark border-r border-hairline dark:border-hairline-dark">
                {/* Live-map motif, reused from the landing page as the one signature visual */}
                <div className="absolute inset-0 opacity-70 dark:opacity-40">
                    <MapBackdrop className="w-full h-full">
                        <path
                            d="M60,220 L220,220 L220,90 L440,90 L440,330 L560,330"
                            stroke="#6664d8"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                            opacity="0.5"
                        />
                        <PulseMarker x={560} y={330} color="#6664d8" />
                    </MapBackdrop>
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-card via-card/90 to-card/40 dark:from-card-dark dark:via-card-dark/90 dark:to-card-dark/40 pointer-events-none" />

                <div className="relative z-10 w-full mb-12">
                    <div className="flex items-center space-x-3 mb-10">
                        <span className="grid size-11 place-items-center rounded-xl bg-brand-500 dark:bg-brand-400 shrink-0">
                            <Lightning className="size-6 text-white dark:text-[#16161b]" weight="fill" />
                        </span>
                        <h1 className="text-2xl font-bold text-ink dark:text-ink-dark tracking-tight">
                            VSmart
                        </h1>
                    </div>

                    <div className="max-w-md">
                        <h2 className="text-4xl lg:text-[2.75rem] font-semibold leading-[1.1] tracking-[-0.02em] mb-5 text-ink dark:text-ink-dark">
                            Real-time location.{' '}
                            <span className="bg-gradient-to-r from-brand-500 to-[#198fa4] dark:from-brand-400 dark:to-[#58b8c7] bg-clip-text text-transparent">
                                Instant theft alerts.
                            </span>
                        </h2>
                        <p className="text-[15px] leading-7 text-muted dark:text-muted-dark max-w-sm">
                            Track your vehicle live and get notified the second it leaves a protected zone.
                        </p>
                    </div>

                    <div className="mt-10 space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-hairline dark:border-hairline-dark bg-card dark:bg-card-dark text-brand-500 dark:text-brand-400 shadow-sm">
                                <MapPinLine className="size-4" />
                            </span>
                            <p className="text-sm font-medium text-ink dark:text-ink-dark">Live location, always up to date</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-hairline dark:border-hairline-dark bg-card dark:bg-card-dark text-brand-500 dark:text-brand-400 shadow-sm">
                                <ShieldCheck className="size-4" />
                            </span>
                            <p className="text-sm font-medium text-ink dark:text-ink-dark">Automatic anti-theft protection</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right side: Auth Form */}
            <div className="flex-1 flex flex-col justify-center items-center p-4 sm:p-8 relative z-10 overflow-y-auto bg-surface dark:bg-surface-dark">
                <div className="w-full max-w-[400px] card p-6 sm:p-8 lg:p-10">

                    {onBack && (
                        <button
                            onClick={onBack}
                            className="mb-6 text-sm font-medium text-subtle dark:text-subtle-dark hover:text-ink dark:hover:text-ink-dark transition-colors flex items-center gap-1"
                        >
                            ← Home
                        </button>
                    )}

                    <div className="text-center mb-8">
                        <h3 className="text-2xl font-bold text-ink dark:text-ink-dark mb-2 tracking-tight">
                            {view === 'login' && 'Sign in to your account'}
                            {view === 'register' && 'Create an account'}
                            {view === 'otp' && 'Verify your account'}
                        </h3>
                        <p className="text-sm text-muted dark:text-muted-dark font-medium">
                            {view === 'login' && 'Enter your email and password to access'}
                            {view === 'register' && 'Set up your vehicle tracking workspace'}
                            {view === 'otp' && `We just sent a 6-digit code to ${email}`}
                        </p>
                    </div>

                    {errorMsg && (
                        <div className="mb-6 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 text-sm flex items-start space-x-2">
                            <AlertCircleIcon />
                            <span className="break-words font-medium">{errorMsg}</span>
                        </div>
                    )}

                    <form onSubmit={(e) => handleAction(e, view)} className="space-y-4">
                        {(view === 'login' || view === 'register') && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted dark:text-muted-dark ml-1">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-subtle dark:text-subtle-dark" />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className="input-field pl-10"
                                        placeholder="you@example.com"
                                    />
                                </div>
                            </div>
                        )}

                        {(view === 'login' || view === 'register') && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted dark:text-muted-dark ml-1">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-subtle dark:text-subtle-dark" />
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="input-field pl-10"
                                        placeholder="••••••••"
                                    />
                                </div>
                                {view === 'login' && (
                                    <div className="flex justify-end mt-2">
                                        <button type="button" className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors">
                                            Forgot password?
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {view === 'register' && (
                            <div className="space-y-1.5 animate-fade-in">
                                <label className="text-xs font-semibold text-muted dark:text-muted-dark ml-1">Confirm Password</label>
                                <div className="relative">
                                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-subtle dark:text-subtle-dark" />
                                    <input
                                        type="password"
                                        required
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        className="input-field pl-10"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        )}

                        {view === 'otp' && (
                            <div className="space-y-1.5 animate-fade-in text-center">
                                <label className="text-xs font-semibold text-muted dark:text-muted-dark mb-2 block">6-digit verification code</label>
                                <div className="relative max-w-[200px] mx-auto">
                                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-500 dark:text-brand-400" />
                                    <input
                                        type="text"
                                        required
                                        maxLength={6}
                                        value={otpCode}
                                        onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                        className="input-field pl-10 text-lg font-mono tracking-[0.25em] text-center"
                                        placeholder="000000"
                                    />
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn-primary w-full mt-6 py-3.5 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            <span>
                                {isLoading ? 'Processing...' :
                                    view === 'login' ? 'Sign in' :
                                        view === 'register' ? 'Sign up' : 'Verify Code'}
                            </span>
                            {!isLoading && <ArrowRight className="w-5 h-5 opacity-80" />}
                        </button>
                    </form>

                    <div className="mt-8 text-center border-t border-hairline dark:border-hairline-dark pt-6">
                        {view === 'login' ? (
                            <p className="text-sm text-muted dark:text-muted-dark font-medium">
                                Don't have an account?{' '}
                                <button onClick={() => setView('register')} className="text-brand-600 dark:text-brand-400 font-semibold hover:text-brand-700 dark:hover:text-brand-300 transition-colors">
                                    Sign up now
                                </button>
                            </p>
                        ) : view === 'register' ? (
                            <p className="text-sm text-muted dark:text-muted-dark font-medium">
                                Already have an account?{' '}
                                <button onClick={() => setView('login')} className="text-brand-600 dark:text-brand-400 font-semibold hover:text-brand-700 dark:hover:text-brand-300 transition-colors">
                                    Back to sign in
                                </button>
                            </p>
                        ) : (
                            <p className="text-sm text-muted dark:text-muted-dark font-medium">
                                Didn't receive a code?{' '}
                                <button onClick={handleResendOTP} className="text-brand-600 dark:text-brand-400 font-semibold hover:text-brand-700 dark:hover:text-brand-300 transition-colors">
                                    Resend code
                                </button>
                                {' '}or{' '}
                                <button onClick={() => setView('register')} className="text-subtle dark:text-subtle-dark underline hover:text-muted dark:hover:text-muted-dark transition-colors">
                                    Cancel
                                </button>
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

const AlertCircleIcon = () => (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
);
