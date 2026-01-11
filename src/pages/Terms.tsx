import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const Terms = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </Button>

        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: January 11, 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Agreement to Terms</h2>
            <p className="text-muted-foreground">
              By accessing or using DukaOS ("the App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the App.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
            <p className="text-muted-foreground">
              DukaOS is a point-of-sale and inventory management application designed for Kenyan retailers. The App provides features including:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-2">
              <li>Sales processing and receipt generation</li>
              <li>Inventory tracking and management</li>
              <li>Customer relationship management</li>
              <li>Sales reporting and analytics</li>
              <li>Multi-branch support</li>
              <li>Offline functionality with automatic sync</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. User Accounts</h2>
            <h3 className="text-lg font-medium mb-2">3.1 Registration</h3>
            <p className="text-muted-foreground">
              You must create an account to use DukaOS. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate.
            </p>

            <h3 className="text-lg font-medium mb-2 mt-4">3.2 Account Security</h3>
            <p className="text-muted-foreground">
              You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. Notify us immediately of any unauthorized use.
            </p>

            <h3 className="text-lg font-medium mb-2 mt-4">3.3 User Roles</h3>
            <p className="text-muted-foreground">
              Account owners can assign roles (Owner, Admin, Cashier) to team members. Each role has specific permissions. You are responsible for the actions of users you invite.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Acceptable Use</h2>
            <p className="text-muted-foreground">You agree NOT to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-2">
              <li>Use the App for any illegal purpose</li>
              <li>Attempt to gain unauthorized access to the App or its systems</li>
              <li>Interfere with or disrupt the App's functionality</li>
              <li>Upload malicious code or content</li>
              <li>Use the App to process fraudulent transactions</li>
              <li>Resell or redistribute the App without authorization</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Data and Content</h2>
            <h3 className="text-lg font-medium mb-2">5.1 Your Data</h3>
            <p className="text-muted-foreground">
              You retain ownership of all data you input into DukaOS. You grant us a license to store, process, and display your data solely to provide the service.
            </p>

            <h3 className="text-lg font-medium mb-2 mt-4">5.2 Backups</h3>
            <p className="text-muted-foreground">
              While we maintain regular backups, you are responsible for maintaining your own backups of critical business data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Payment Terms</h2>
            <p className="text-muted-foreground">
              DukaOS offers free and paid subscription plans. Paid features are subject to payment of applicable fees. Fees are non-refundable except as required by law or as explicitly stated.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. M-Pesa Integration</h2>
            <p className="text-muted-foreground">
              DukaOS allows you to record M-Pesa transactions but does not directly process M-Pesa payments. You are responsible for:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-2">
              <li>Maintaining a valid M-Pesa Till or Paybill account with Safaricom</li>
              <li>Complying with Safaricom's M-Pesa terms and conditions</li>
              <li>Accurately recording transaction details</li>
              <li>Resolving any M-Pesa payment disputes with your customers</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Offline Functionality</h2>
            <p className="text-muted-foreground">
              DukaOS supports offline operation. Data created offline will sync when you reconnect to the internet. We are not responsible for data loss due to device failure before sync completion.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Disclaimers</h2>
            <p className="text-muted-foreground">
              THE APP IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DO NOT GUARANTEE THAT THE APP WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE. YOU USE THE APP AT YOUR OWN RISK.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Limitation of Liability</h2>
            <p className="text-muted-foreground">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, DUKAOS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Indemnification</h2>
            <p className="text-muted-foreground">
              You agree to indemnify and hold harmless DukaOS and its affiliates from any claims, damages, or expenses arising from your use of the App or violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Termination</h2>
            <p className="text-muted-foreground">
              We may suspend or terminate your access to the App at any time for violation of these Terms. You may close your account at any time. Upon termination, your right to use the App ceases immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">13. Governing Law</h2>
            <p className="text-muted-foreground">
              These Terms are governed by the laws of Kenya. Any disputes shall be resolved in the courts of Nairobi, Kenya.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">14. Changes to Terms</h2>
            <p className="text-muted-foreground">
              We may modify these Terms at any time. Continued use of the App after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">15. Contact</h2>
            <p className="text-muted-foreground">
              For questions about these Terms, contact us at:
            </p>
            <ul className="list-none text-muted-foreground space-y-1 mt-2">
              <li>Email: legal@dukaos.co.ke</li>
              <li>Website: https://dukaos.co.ke</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Terms;
