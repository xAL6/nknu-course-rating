import { redirect } from "next/navigation";

// Google handles both sign-in and sign-up, so there's no separate sign-up flow.
export default function SignUpPage() {
  redirect("/sign-in");
}
