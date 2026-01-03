import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Eye, EyeOff, Store, ArrowRight } from 'lucide-react';
import { z } from 'zod';

const authSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters').optional()
});

const Auth = () => {
  const navigate = useNavigate();
  const { user, signIn, signUp, resetPassword, loading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const validateForm = () => {
    try {
      if (isForgotPassword) {
        authSchema.pick({ email: true }).parse(formData);
      } else if (isLogin) {
        authSchema.pick({ email: true, password: true }).parse(formData);
      } else {
        authSchema.parse({ ...formData, fullName: formData.fullName });
      }
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach(err => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);

    try {
      if (isForgotPassword) {
        const { error } = await resetPassword(formData.email);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Password reset email sent! Check your inbox.');
          setIsForgotPassword(false);
        }
      } else if (isLogin) {
        const { error } = await signIn(formData.email, formData.password);
        if (error) {
          if (error.message.includes('Invalid login')) {
            toast.error('Invalid email or password');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Welcome back!');
          navigate('/dashboard');
        }
      } else {
        const { error } = await signUp(formData.email, formData.password, formData.fullName);
        if (error) {
          if (error.message.includes('already registered')) {
            toast.error('This email is already registered. Please sign in.');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Account created successfully!');
          navigate('/dashboard');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-dark p-12 flex-col justify-between relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent rounded-full blur-3xl" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-glow">
              <Store className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold text-white">DukaOS</span>
          </div>
          
          <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
            Sell Smarter.<br />
            <span className="text-primary">Grow Faster.</span>
          </h1>
          <p className="text-lg text-white/70 max-w-md">
            The complete POS system designed for Kenyan retailers. Works offline, accepts M-Pesa, and scales with your business.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-6 text-white/60 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success" />
            5K+ Shops
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success" />
            99.9% Uptime
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success" />
            Offline Ready
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <Card variant="elevated" className="w-full max-w-md">
          <CardHeader className="text-center pb-2">
            {/* Mobile logo */}
            <div className="lg:hidden mx-auto w-14 h-14 bg-gradient-hero rounded-2xl flex items-center justify-center mb-4 shadow-glow">
              <Store className="w-7 h-7 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">
              {isForgotPassword ? 'Reset Password' : isLogin ? 'Welcome back' : 'Create account'}
            </CardTitle>
            <CardDescription className="text-base">
              {isForgotPassword 
                ? 'Enter your email to receive a reset link'
                : isLogin 
                  ? 'Sign in to access your dashboard' 
                  : 'Get started in less than 5 minutes'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && !isForgotPassword && (
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Kamau"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className={errors.fullName ? 'border-destructive' : ''}
                  />
                  {errors.fullName && (
                    <p className="text-xs text-destructive">{errors.fullName}</p>
                  )}
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={errors.email ? 'border-destructive' : ''}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email}</p>
                )}
              </div>
              
              {!isForgotPassword && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                    {isLogin && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotPassword(true);
                          setErrors({});
                        }}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-destructive">{errors.password}</p>
                  )}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting 
                  ? 'Please wait...' 
                  : isForgotPassword 
                    ? 'Send Reset Link' 
                    : isLogin 
                      ? 'Sign In' 
                      : 'Create Account'}
                {!isSubmitting && <ArrowRight className="w-4 h-4" />}
              </Button>
            </form>

            <div className="mt-6 text-center">
              {isForgotPassword ? (
                <p className="text-sm text-muted-foreground">
                  Remember your password?
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(false);
                      setErrors({});
                    }}
                    className="ml-1 text-primary font-semibold hover:underline"
                  >
                    Back to sign in
                  </button>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {isLogin ? "Don't have an account?" : 'Already have an account?'}
                  <button
                    type="button"
                    onClick={() => {
                      setIsLogin(!isLogin);
                      setErrors({});
                    }}
                    className="ml-1 text-primary font-semibold hover:underline"
                  >
                    {isLogin ? 'Sign up' : 'Sign in'}
                  </button>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;