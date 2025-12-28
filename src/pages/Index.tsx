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
  Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";

const features = [
  {
    icon: WifiOff,
    title: "Offline-First POS",
    description: "Sell anywhere, anytime. No internet? No problem. Sync automatically when back online."
  },
  {
    icon: CreditCard,
    title: "M-Pesa & Cash Ready",
    description: "Accept M-Pesa Till, Paybill, and cash. Split payments supported."
  },
  {
    icon: Package,
    title: "Smart Inventory",
    description: "Track stock, set low alerts, scan barcodes, and manage expiry dates effortlessly."
  },
  {
    icon: BarChart3,
    title: "Daily Reports",
    description: "Get sales insights. Print or share via WhatsApp. Know your business health."
  },
  {
    icon: Users,
    title: "Customer Loyalty",
    description: "Build lasting relationships with loyalty points, purchase history, and personalized offers."
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
  { value: "5K+", label: "Shops Powered" },
  { value: "50M+", label: "Transactions" },
  { value: "99.9%", label: "Uptime" },
  { value: "<5 min", label: "Setup Time" }
];

export default function Index() {
  return (
    <div className="min-h-screen bg-gradient-warm">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-hero flex items-center justify-center">
              <Store className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold text-foreground">DukaOS</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
            <a href="#contact" className="text-muted-foreground hover:text-foreground transition-colors">Contact</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Login</Button>
            </Link>
            <Link to="/auth">
              <Button variant="hero" size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-24 md:pt-24 md:pb-32">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-1/4 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse-soft" />
          <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: '1s' }} />
        </div>
        
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6 animate-fade-in">
              <Zap className="w-4 h-4" />
              <span>Built for Kenyan Retailers</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-foreground mb-6 leading-tight animate-slide-up">
              Sell Smarter.{" "}
              <span className="text-gradient">Grow Faster.</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: '0.1s' }}>
              The complete CRM-POS system designed for Kenyan dukas. Works offline, accepts M-Pesa, and scales with your business.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <Link to="/auth">
                <Button variant="hero" size="xl">
                  Start Selling in 5 Minutes
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Button variant="outline" size="xl">
                <Smartphone className="w-5 h-5" />
                Watch Demo
              </Button>
            </div>

            {/* Trust indicators */}
            <div className="mt-12 flex flex-wrap justify-center gap-8 animate-fade-in" style={{ animationDelay: '0.4s' }}>
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-primary">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* POS Preview */}
      <section className="py-16 bg-secondary/30">
        <div className="container mx-auto px-4">
          <Card variant="elevated" className="max-w-5xl mx-auto overflow-hidden">
            <div className="bg-gradient-hero p-4 flex items-center gap-3">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-primary-foreground/30" />
                <div className="w-3 h-3 rounded-full bg-primary-foreground/30" />
                <div className="w-3 h-3 rounded-full bg-primary-foreground/30" />
              </div>
              <span className="text-primary-foreground/80 text-sm font-medium">DukaOS Point of Sale</span>
            </div>
            <div className="p-6 md:p-8">
              <div className="grid md:grid-cols-3 gap-6">
                {/* Products Grid */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg">Quick Products</h3>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm">All</Button>
                      <Button variant="ghost" size="sm">Groceries</Button>
                      <Button variant="ghost" size="sm">Beverages</Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
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
                      <button
                        key={i}
                        className="p-4 rounded-xl bg-secondary hover:bg-primary hover:text-primary-foreground transition-all duration-200 text-center group"
                      >
                        <div className="text-2xl mb-2">📦</div>
                        <div className="font-medium text-sm truncate">{product.name}</div>
                        <div className="text-xs text-muted-foreground group-hover:text-primary-foreground/80">
                          KES {product.price}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cart */}
                <div className="bg-muted/50 rounded-xl p-4">
                  <h3 className="font-semibold mb-4 flex items-center justify-between">
                    Current Sale
                    <span className="text-sm font-normal text-muted-foreground">3 items</span>
                  </h3>
                  <div className="space-y-3 mb-4">
                    {[
                      { name: "Unga 2kg", qty: 2, price: 360 },
                      { name: "Sugar 1kg", qty: 1, price: 150 },
                      { name: "Cooking Oil", qty: 1, price: 280 },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span>{item.name} x{item.qty}</span>
                        <span className="font-medium">KES {item.price}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border pt-4 mb-4">
                    <div className="flex items-center justify-between font-bold text-lg">
                      <span>Total</span>
                      <span className="text-primary">KES 790</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" className="h-14">
                      💵 Cash
                    </Button>
                    <Button variant="hero" className="h-14">
                      📱 M-Pesa
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Everything You Need to Run Your{" "}
              <span className="text-gradient">Duka</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Powerful features designed for how Kenyan businesses actually work.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} variant="feature" className="p-6">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Offline Highlight */}
      <section className="py-16 bg-gradient-hero text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-primary-foreground/20 px-4 py-2 rounded-full mb-6">
              <WifiOff className="w-5 h-5" />
              <span className="font-medium">Offline Mode</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Keep Selling When the Internet Goes Down
            </h2>
            <p className="text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
              DukaOS works completely offline. Record sales, manage inventory, and serve customers — all without internet. Data syncs automatically when you're back online.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="outline-light" size="lg">
                <Wifi className="w-5 h-5" />
                Learn About Offline Sync
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-muted-foreground">
              Start free, upgrade as you grow. No hidden fees.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {pricingTiers.map((tier, index) => (
              <Card 
                key={index} 
                variant={tier.featured ? "pricing-featured" : "pricing"}
                className="p-8 relative"
              >
                {tier.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-accent text-accent-foreground px-4 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                      <Star className="w-4 h-4" /> Most Popular
                    </span>
                  </div>
                )}
                <div className="mb-6">
                  <h3 className={`text-xl font-bold mb-2 ${tier.featured ? 'text-primary-foreground' : ''}`}>
                    {tier.name}
                  </h3>
                  <p className={`text-sm mb-4 ${tier.featured ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                    {tier.description}
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-4xl font-bold ${tier.featured ? 'text-primary-foreground' : ''}`}>
                      {tier.price}
                    </span>
                    <span className={`text-sm ${tier.featured ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {tier.period}
                    </span>
                  </div>
                </div>
                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, i) => (
                    <li key={i} className={`flex items-start gap-2 text-sm ${tier.featured ? 'text-primary-foreground/90' : ''}`}>
                      <Check className={`w-5 h-5 flex-shrink-0 ${tier.featured ? 'text-primary-foreground' : 'text-primary'}`} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button 
                  variant={tier.featured ? "outline-light" : "default"} 
                  className="w-full"
                  size="lg"
                >
                  {tier.cta}
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card variant="glass" className="p-8 md:p-12 text-center">
              <div className="flex justify-center gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="w-6 h-6 text-warning fill-warning" />
                ))}
              </div>
              <blockquote className="text-xl md:text-2xl font-medium mb-6 text-foreground">
                "DukaOS transformed how I run my three shops. I can now see all my inventory and sales from anywhere, even when the network is down. My staff love how easy it is to use!"
              </blockquote>
              <div>
                <div className="font-bold">Mary Wanjiku</div>
                <div className="text-muted-foreground">Owner, Wanjiku Groceries — Nairobi</div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contact" className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <Card variant="elevated" className="max-w-4xl mx-auto bg-gradient-hero text-primary-foreground p-8 md:p-16 text-center">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Ready to Grow Your Business?
            </h2>
            <p className="text-xl text-primary-foreground/80 mb-8 max-w-xl mx-auto">
              Join thousands of Kenyan retailers already using DukaOS. Start selling in less than 5 minutes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth">
                <Button variant="outline-light" size="xl">
                  Start Free Today
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Button variant="ghost" size="xl" className="text-primary-foreground hover:bg-primary-foreground/10">
                Talk to Sales
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-hero flex items-center justify-center">
                  <Store className="w-6 h-6 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold">DukaOS</span>
              </div>
              <p className="text-muted-foreground text-sm">
                The complete CRM-POS solution built for African retail businesses.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Integrations</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Training Videos</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">WhatsApp Support</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contact Us</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Data Ownership</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © 2025 DukaOS. Built with ❤️ for Kenyan businesses.
            </p>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">Your data stays yours. Always.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
