import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-40 h-12 bg-card/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="flex items-center h-full px-4 max-w-2xl mx-auto gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="w-9 h-9 rounded-full p-0">
              <ArrowLeft size={16} />
            </Button>
          </Link>
          <span className="font-semibold text-sm flex items-center gap-1.5">
            <FileText size={14} className="text-indigo-500" /> Terms of Service
          </span>
        </div>
      </header>

      <main className="pt-16 pb-16 px-4 max-w-2xl mx-auto">
        <div className="space-y-6 mt-4 text-sm text-foreground leading-relaxed">

          <section>
            <h2 className="text-base font-bold mb-2">1. Acceptance of Terms</h2>
            <p>By accessing or using Marie's Vault ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Platform.</p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">2. Age Requirement</h2>
            <p>The Platform contains adult-oriented content. By using the Platform you confirm that you are at least 18 years of age, or the age of majority in your jurisdiction if higher. If you are under 18, you must leave immediately.</p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">3. User Accounts</h2>
            <p>You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You agree to notify us immediately of any unauthorised use of your account.</p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">4. User-Generated Content</h2>
            <p>Users may submit content to the Platform. By submitting content you:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Represent that you own the content or have the rights to share it</li>
              <li>Grant Marie's Vault a non-exclusive licence to display the content on the Platform</li>
              <li>Accept full responsibility for any claims arising from your submitted content</li>
            </ul>
            <p className="mt-2">Marie's Vault does not pre-screen user content and is not responsible for content submitted by users. We act as a passive host under the DMCA safe harbour provisions.</p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">5. Prohibited Content</h2>
            <p>You may not submit content that:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Depicts minors in a sexual context under any circumstances</li>
              <li>You do not have the right to distribute</li>
              <li>Depicts real, identifiable people without their consent</li>
              <li>Contains malware, spam, or harmful code</li>
              <li>Violates any applicable law</li>
            </ul>
            <p className="mt-2">Violation of these rules will result in immediate account termination and may be reported to law enforcement.</p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">6. Copyright & DMCA</h2>
            <p>We respect intellectual property rights and comply with the DMCA. To report copyright infringement, see our <Link href="/dmca" className="text-indigo-600 underline">DMCA Policy</Link>. Repeat infringers will have their accounts terminated.</p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">7. Subscriptions & Payments</h2>
            <p>Paid subscription tiers grant access to additional features. Subscriptions renew automatically. You may cancel at any time and will retain access until the end of the current billing period. Refunds are not provided for partial periods.</p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">8. Termination</h2>
            <p>We reserve the right to terminate or suspend any account at our discretion, with or without notice, for violation of these Terms or for any other reason.</p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">9. Disclaimer of Warranties</h2>
            <p>The Platform is provided "as is" without warranties of any kind. We do not guarantee uninterrupted or error-free service.</p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">10. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, Marie's Vault shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Platform.</p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">11. Changes to Terms</h2>
            <p>We may update these Terms at any time. Continued use of the Platform after changes constitutes acceptance of the updated Terms.</p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">12. Contact</h2>
            <p>For questions about these Terms: <a href="mailto:hello@mariesvault.com" className="text-indigo-600 underline">hello@mariesvault.com</a></p>
            <p className="text-xs text-muted-foreground mt-2">Last updated: March 2026</p>
          </section>

        </div>
      </main>
    </div>
  );
}
