import { 
  Smartphone, 
  Wifi, 
  WifiOff, 
  CreditCard, 
  BarChart3, 
  Users, 
  Package, 
  Store, 
  Shield, 
  Zap,
  ArrowRight,
  Check,
  Star,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";

const features = [
  {
    icon: WifiOff,
    title: "Offline-First POS",
    description: "Sell anywhere, anytime. Sync automatically when back online."
  },
  {
    icon: CreditCard,
    title: "M-Pesa & Cash Ready",
    description: "Accept M-Pesa Till, Paybill, and cash. Split payments supported."
  },
  {
    icon: Package,
    title: "Smart Inventory",
    description: "Track stock, set alerts, scan barcodes, manage expiry dates."
  },
  {
    icon: BarChart3,
    title: "Daily Reports",
    description: "Get sales insights. Print or share via WhatsApp instantly."
  },
  {
    icon: Users,
    title: "Customer Loyalty",
    description: "Build relationships with points, history, and personalized offers."
  },
  {
    icon: Store,
    title: "Multi-Branch Ready",
    description: "Scale from one shop to many. Centralized control, local flexibility."
  }
];

const pricingTiers = [
  {
    name: "Starter",
    price: "Free",
    period: "forever",
    description: "Perfect for small dukas getting started",
    features: [
      "1 device, 1 user",
      "Basic POS & inventory",
      "Cash & M-Pesa payments",
      "Daily sales reports",
      "Offline mode"
    ],
    cta: "Start Free",
    featured: false
  },
  {
    name: "Business",
    price: "KES 2,500",
    period: "/month",
    description: "For growing shops with more needs",
    features: [
      "3 devices, 5 users",
      "Advanced inventory & alerts",
      "Customer loyalty program",
      "WhatsApp reports",
      "Priority support",
      "Multi-payment splits"
    ],
    cta: "Start 14-Day Trial",
    featured: true
  },
  {
    name: "Enterprise",
    price: "KES 8,000",
    period: "/month",
    description: "For multi-branch operations",
    features: [
      "Unlimited devices & users",
      "Multi-branch management",
      "HQ & branch dashboards",
      "Stock transfers",
      "Role-based permissions",
      "API access",
      "Dedicated support"
    ],
    cta: "Contact Sales",
    featured: false
  }
];

const stats = [
  { value: "500+", label: "Active Shops" },
  { value: "10K+", label: "Transactions/Day" },
  { value: "99.9%", label: "Uptime" },
  { value: "<5 min", label: "Setup Time" }
];

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-hero flex items-center justify-center shadow-soft">
              <Store className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-display font-bold text-foreground">DukaOS</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">Features</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">Pricing</a>
            <a href="#contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">Contact</a>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Login</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        </div>
        
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-semibold mb-6 animate-fade-in">
              <Zap className="w-4 h-4" />
              <span>Built for Kenyan Retailers</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-extrabold text-foreground mb-5 leading-[1.08] animate-slide-up tracking-tight">
              Sell Smarter.{" "}
              <span className="text-gradient">Grow Faster.</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl mx-auto animate-slide-up" style={{ animationDelay: '0.1s' }}>
              The complete CRM-POS system designed for Kenyan dukas. Works offline, accepts M-Pesa, and scales with your business.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <Link to="/auth">
                <Button size="xl" className="w-full sm:w-auto">
                  Start Selling in 5 Minutes
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Button variant="outline" size="xl" className="w-full sm:w-auto">
                <Smartphone className="w-5 h-5" />
                Watch Demo
              </Button>
            </div>

            {/* Stats */}
            <div className="mt-14 flex flex-wrap justify-center gap-x-10 gap-y-4 animate-fade-in" style={{ animationDelay: '0.4s' }}>
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-foreground">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* POS Preview */}
      <section className="py-12 bg-secondary/40">
        <div className="container mx-auto px-4">
          <Card variant="elevated" className="max-w-4xl mx-auto overflow-hidden">
            <div className="bg-gradient-hero p-3 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-white/30" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/30" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/30" />
              </div>
              <span className="text-primary-foreground/80 text-xs font-medium">DukaOS Point of Sale</span>
            </div>
            <CardContent className="p-5">
              <div className="grid md:grid-cols-3 gap-4">
                {/* Products */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm">Quick Products</h3>
                    <div className="flex gap-1.5">
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-md font-medium">All</span>
                      <span className="text-xs bg-secondary px-2 py-1 rounded-md">Groceries</span>
                      <span className="text-xs bg-secondary px-2 py-1 rounded-md">Beverages</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { name: "Unga 2kg", price: "180" },
                      { name: "Sugar 1kg", price: "150" },
                      { name: "Cooking Oil", price: "280" },
                      { name: "Bread", price: "60" },
                      { name: "Milk 500ml", price: "55" },
                      { name: "Eggs (Tray)", price: "420" },
                      { name: "Rice 2kg", price: "320" },
                      { name: "Tea Leaves", price: "120" },
                    ].map((product, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors text-center cursor-pointer group"
                      >
                        <div className="text-xl mb-1">📦</div>
                        <div className="font-medium text-xs truncate">{product.name}</div>
                        <div className="text-2xs text-muted-foreground group-hover:text-primary-foreground/80">
                          KES {product.price}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cart */}
                <div className="bg-secondary/70 rounded-lg p-3">
                  <h3 className="font-semibold text-sm mb-3 flex items-center justify-between">
                    Current Sale
                    <span className="text-xs font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">3 items</span>
                  </h3>
                  <div className="space-y-2 mb-3 text-sm">
                    {[
                      { name: "Unga 2kg", qty: 2, price: 360 },
                      { name: "Sugar 1kg", qty: 1, price: 150 },
                      { name: "Cooking Oil", qty: 1, price: 280 },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-muted-foreground">{item.name} x{item.qty}</span>
                        <span className="font-medium tabular-nums">{item.price}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border pt-3 mb-3">
                    <div className="flex items-center justify-between font-bold">
                      <span>Total</span>
                      <span className="text-primary text-lg">KES 790</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" size="sm" className="text-xs">
                      💵 Cash
                    </Button>
                    <Button variant="accent" size="sm" className="text-xs">
                      📱 M-Pesa
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-3">
              Everything You Need to Run Your{" "}
              <span className="text-gradient">Duka</span>
            </h2>
            <p className="text-muted-foreground">
              Powerful features designed for how Kenyan businesses actually work.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {features.map((feature, index) => (
              <Card key={index} variant="feature" className="p-5">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base font-bold mb-1">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Offline Highlight */}
      <section className="py-14 bg-gradient-hero text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/15 px-3 py-1.5 rounded-full text-sm font-semibold mb-5">
              <WifiOff className="w-4 h-4" />
              <span>Offline Mode</span>
            </div>
            <h2 className="text-2xl md:text-4xl font-bold mb-4">
              Keep Selling When the Internet Goes Down
            </h2>
            <p className="text-lg text-primary-foreground/80 mb-6 max-w-xl mx-auto">
              DukaOS works completely offline. Record sales, manage inventory, and serve customers — all without internet. Data syncs automatically when you're back online.
            </p>
            <Button variant="outline-light" size="lg">
              <Wifi className="w-5 h-5" />
              Learn About Offline Sync
            </Button>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Simple, Transparent Pricing
            </h2>
            <p className="text-muted-foreground">
              Start free, upgrade as you grow. No hidden fees.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {pricingTiers.map((tier, index) => (
              <Card 
                key={index} 
                variant={tier.featured ? "pricing-featured" : "pricing"}
                className="p-6 relative"
              >
                {tier.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-accent text-accent-foreground px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-accent">
                      <Star className="w-3 h-3" /> Most Popular
                    </span>
                  </div>
                )}
                <div className="mb-5">
                  <h3 className={`text-lg font-bold mb-1 ${tier.featured ? 'text-primary-foreground' : ''}`}>
                    {tier.name}
                  </h3>
                  <p className={`text-xs mb-3 ${tier.featured ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {tier.description}
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-3xl font-bold ${tier.featured ? 'text-primary-foreground' : ''}`}>
                      {tier.price}
                    </span>
                    <span className={`text-sm ${tier.featured ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                      {tier.period}
                    </span>
                  </div>
                </div>
                <ul className="space-y-2 mb-6">
                  {tier.features.map((feature, i) => (
                    <li key={i} className={`flex items-start gap-2 text-sm ${tier.featured ? 'text-primary-foreground/90' : ''}`}>
                      <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${tier.featured ? 'text-primary-foreground' : 'text-success'}`} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button 
                  variant={tier.featured ? "outline-light" : "default"} 
                  className="w-full"
                  size="default"
                >
                  {tier.cta}
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-12 bg-secondary/40">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <Card variant="glass" className="p-8 text-center">
              <div className="flex justify-center gap-0.5 mb-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="w-5 h-5 text-warning fill-warning" />
                ))}
              </div>
              <blockquote className="text-lg md:text-xl font-medium mb-5 text-foreground leading-relaxed">
                "DukaOS transformed how I run my three shops. I can now see all my inventory and sales from anywhere, even when the network is down."
              </blockquote>
              <div>
                <div className="font-bold text-sm">Mary Wanjiku</div>
                <div className="text-sm text-muted-foreground">Owner, Wanjiku Groceries — Nairobi</div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contact" className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <Card variant="elevated" className="max-w-3xl mx-auto bg-gradient-hero text-primary-foreground p-8 md:p-12 text-center">
            <h2 className="text-2xl md:text-4xl font-bold mb-4">
              Ready to Grow Your Business?
            </h2>
            <p className="text-lg text-primary-foreground/80 mb-6 max-w-md mx-auto">
              Join thousands of Kenyan retailers already using DukaOS. Start selling in less than 5 minutes.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/auth">
                <Button variant="outline-light" size="lg" className="w-full sm:w-auto">
                  Start Free Trial
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Button variant="ghost" size="lg" className="text-primary-foreground hover:bg-white/10 w-full sm:w-auto">
                <Shield className="w-5 h-5" />
                Talk to Sales
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-gradient-hero flex items-center justify-center">
                <Store className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-sm">DukaOS</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
              <a href="mailto:support@dukaos.co.ke" className="hover:text-foreground transition-colors">Support</a>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 DukaOS. Built for Kenyan Retailers.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}