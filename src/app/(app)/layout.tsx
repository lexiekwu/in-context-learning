import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppNavbar } from "@/components/app-navbar";
import { SubscriptionBanner } from "@/components/subscription-banner";

/**
 * Layout for authenticated app routes (/dashboard, /quiz, /cards, /settings).
 * Redirects unauthenticated users to the sign-in page.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <AppNavbar user={session.user} />
      <SubscriptionBanner />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
