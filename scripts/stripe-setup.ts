import Stripe from "stripe";

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("Set STRIPE_SECRET_KEY environment variable first.");
    process.exit(1);
  }

  const stripe = new Stripe(key, { apiVersion: "2026-01-28.clover" });

  console.log("Creating product...");
  const product = await stripe.products.create({
    name: "In Context Flashcards Pro",
    description: "Unlimited access to Mandarin quiz and flashcard features",
  });

  console.log("Creating monthly price...");
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 999, // $9.99/month
    currency: "usd",
    recurring: { interval: "month" },
  });

  console.log("\nDone! Add this to your .env:\n");
  console.log(`STRIPE_MONTHLY_PRICE_ID=${price.id}`);
}

main().catch(console.error);
