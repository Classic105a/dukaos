import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </Button>

        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: January 11, 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
            <p className="text-muted-foreground">
              DukaOS ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our point-of-sale and inventory management application ("DukaOS" or "the App").
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
            <h3 className="text-lg font-medium mb-2">2.1 Account Information</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Email address and password (encrypted)</li>
              <li>Full name and phone number</li>
              <li>Business name and branch information</li>
            </ul>

            <h3 className="text-lg font-medium mb-2 mt-4">2.2 Business Data</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Product inventory and pricing</li>
              <li>Sales transactions and receipts</li>
              <li>Customer information (if added)</li>
              <li>Payment records including M-Pesa transaction references</li>
            </ul>

            <h3 className="text-lg font-medium mb-2 mt-4">2.3 Device Information</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Device type and operating system</li>
              <li>Browser type and version</li>
              <li>Network connection status (online/offline)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>To provide and maintain the DukaOS service</li>
              <li>To process sales transactions and generate receipts</li>
              <li>To sync your data across devices when online</li>
              <li>To send important service notifications</li>
              <li>To improve our app and develop new features</li>
              <li>To provide customer support</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Data Storage and Security</h2>
            <p className="text-muted-foreground">
              Your data is stored securely using industry-standard encryption. We use Supabase (PostgreSQL) for cloud storage with Row Level Security (RLS) policies ensuring you can only access your own data. Offline data is stored locally on your device and synced securely when you're back online.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. M-Pesa Payment Data</h2>
            <p className="text-muted-foreground">
              When you record M-Pesa payments, we store only the transaction reference number and phone number for your records. We do not process M-Pesa payments directly - you receive payments through Safaricom's M-Pesa service using your own Till or Paybill number.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Data Sharing</h2>
            <p className="text-muted-foreground">
              We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-2">
              <li>With your explicit consent</li>
              <li>To comply with legal obligations</li>
              <li>To protect our rights and prevent fraud</li>
              <li>With service providers who assist in operating our app (under strict confidentiality agreements)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Data Retention</h2>
            <p className="text-muted-foreground">
              We retain your data for as long as your account is active or as needed to provide services. You can request deletion of your account and associated data at any time by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Your Rights</h2>
            <p className="text-muted-foreground">You have the right to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-2">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Export your data in a portable format</li>
              <li>Withdraw consent at any time</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Children's Privacy</h2>
            <p className="text-muted-foreground">
              DukaOS is not intended for use by children under 18. We do not knowingly collect personal information from children.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Changes to This Policy</h2>
            <p className="text-muted-foreground">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Contact Us</h2>
            <p className="text-muted-foreground">
              If you have questions about this Privacy Policy, please contact us at:
            </p>
            <ul className="list-none text-muted-foreground space-y-1 mt-2">
              <li>Email: privacy@dukaos.co.ke</li>
              <li>Website: https://dukaos.co.ke</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
