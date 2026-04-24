export default function PrivacyPolicy() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-zinc-300">
      <h1 className="mb-8 text-3xl font-bold text-zinc-100">Privacy Policy</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Last updated: February 25, 2026
      </p>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-zinc-100">
          What Data We Collect
        </h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Account information:</strong> When you sign in with Google,
            we store your name, email address, and profile picture.
          </li>
          <li>
            <strong>Flashcard data:</strong> The vocabulary cards you create or
            import, including words, definitions, example sentences, and spaced
            repetition scheduling data.
          </li>
          <li>
            <strong>Study history:</strong> Quiz and review session records,
            including your answers, scores, and response times.
          </li>
          <li>
            <strong>Payment information:</strong> If you subscribe, Stripe
            processes your payment. We store only your Stripe customer ID and
            subscription status — never your card details.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-zinc-100">
          How We Use Your Data
        </h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>To provide and improve the flashcard and quiz experience</li>
          <li>
            To generate AI-powered example sentences and translation feedback
          </li>
          <li>To manage your subscription and billing</li>
          <li>To enforce rate limits and prevent abuse</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-zinc-100">
          Third-Party Services
        </h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Google OAuth:</strong> Authentication provider
          </li>
          <li>
            <strong>Stripe:</strong> Payment processing
          </li>
          <li>
            <strong>Google Gemini:</strong> AI sentence generation and
            translation checking
          </li>
          <li>
            <strong>Supabase:</strong> Database hosting
          </li>
          <li>
            <strong>Upstash:</strong> Rate limiting
          </li>
          <li>
            <strong>Vercel:</strong> Application hosting and analytics
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-zinc-100">
          Data Retention
        </h2>
        <p>
          Your data is retained for as long as your account is active. If you
          delete your account, all associated data (flashcards, study history,
          and personal information) is permanently removed from our database.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-zinc-100">
          Your Rights
        </h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Access:</strong> You can view all your data within the app.
          </li>
          <li>
            <strong>Deletion:</strong> You can request deletion of your account
            and all associated data by contacting us.
          </li>
          <li>
            <strong>Portability:</strong> You can export your flashcard data at
            any time.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-zinc-100">
          Data Security
        </h2>
        <p>
          All data is transmitted over HTTPS. Database connections use TLS
          encryption. We do not sell or share your personal data with third
          parties for advertising purposes.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-zinc-100">Contact</h2>
        <p>
          For privacy-related questions or data deletion requests, contact us at{" "}
          <a
            href="mailto:lexiekwu@gmail.com"
            className="text-indigo-400 hover:text-indigo-300 underline"
          >
            lexiekwu@gmail.com
          </a>
          .
        </p>
      </section>
    </main>
  );
}
