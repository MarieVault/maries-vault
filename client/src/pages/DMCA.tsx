import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield } from "lucide-react";

export default function DMCAPage() {
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
            <Shield size={14} className="text-indigo-500" /> DMCA & Copyright Policy
          </span>
        </div>
      </header>

      <main className="pt-16 pb-16 px-4 max-w-2xl mx-auto prose prose-sm">
        <div className="space-y-6 mt-4 text-sm text-foreground leading-relaxed">

          <section>
            <h2 className="text-base font-bold mb-2">Copyright Policy</h2>
            <p>Marie's Vault respects the intellectual property rights of others and expects users of the platform to do the same. In accordance with the Digital Millennium Copyright Act of 1998 (DMCA), we will respond promptly to claims of copyright infringement committed using our service.</p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">Reporting Copyright Infringement</h2>
            <p>If you believe that content hosted on Marie's Vault infringes your copyright, please send a written notice containing all of the following:</p>
            <ol className="list-decimal pl-5 space-y-1 mt-2">
              <li>Your full legal name and contact information (address, phone number, email)</li>
              <li>A description of the copyrighted work you claim has been infringed</li>
              <li>The URL or specific location of the allegedly infringing content on our site</li>
              <li>A statement that you have a good faith belief the use is not authorised by the copyright owner, its agent, or the law</li>
              <li>A statement that the information in your notice is accurate and, under penalty of perjury, that you are the copyright owner or authorised to act on their behalf</li>
              <li>Your physical or electronic signature</li>
            </ol>
            <p className="mt-3">Send DMCA notices to: <a href="mailto:dmca@mariesvault.com" className="text-indigo-600 underline">dmca@mariesvault.com</a></p>
            <p className="mt-2 text-muted-foreground text-xs">We will respond to valid notices within 48 hours and remove or disable access to the infringing content expeditiously.</p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">Counter-Notification</h2>
            <p>If you believe content was removed in error, you may submit a counter-notification. Counter-notifications must include:</p>
            <ol className="list-decimal pl-5 space-y-1 mt-2">
              <li>Your name, address, phone number, and email</li>
              <li>Identification of the content that was removed and where it appeared</li>
              <li>A statement under penalty of perjury that you have a good faith belief the content was removed by mistake or misidentification</li>
              <li>A statement consenting to the jurisdiction of the federal district court for your location</li>
              <li>Your physical or electronic signature</li>
            </ol>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">Repeat Infringer Policy</h2>
            <p>Marie's Vault maintains a strict repeat infringer policy. Users who are found to have uploaded infringing content on more than one occasion will have their accounts terminated. We reserve the right to terminate any account at our discretion for copyright infringement.</p>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">User Responsibility</h2>
            <p>By uploading content to Marie's Vault, you represent and warrant that:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>You own the content or have the right to share it</li>
              <li>The content does not infringe any third party's intellectual property rights</li>
              <li>You accept full responsibility for any claims arising from content you upload</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold mb-2">Designated Copyright Agent</h2>
            <p className="text-muted-foreground text-xs">
              Marie's Vault<br />
              Designated DMCA Agent<br />
              Email: <a href="mailto:dmca@mariesvault.com" className="text-indigo-600 underline">dmca@mariesvault.com</a>
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Note: This contact is for copyright issues only. Other inquiries sent to this address will not receive a response.
            </p>
          </section>

        </div>
      </main>
    </div>
  );
}
