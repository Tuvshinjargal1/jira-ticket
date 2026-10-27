import { headers } from "next/headers";
import { buttonVariants } from "@/components/ui/button";
import { originFromHeaders, redirectUri } from "@/lib/microsoft-auth";
import { cn } from "@/lib/utils";

const ERRORS: Record<string, string> = {
  domain: "Зөвхөн @zerotech.mn ажлын имэйлээр нэвтэрнэ. Бүртгэл сонгох цонхон дээр ажлын хаягаа сонгоно уу.",
  state: "Нэвтрэлт тасарлаа. Дахин оролдоно уу.",
  token: "Microsoft нэвтрэлт амжилтгүй боллоо. Дахин оролдоно уу.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const origin = originFromHeaders(await headers());
  const callback = redirectUri(origin);
  const message =
    error === "redirect"
      ? `Azure апп дээр буцах хаяг бүртгэлгүй байна. Authentication → Web дээр ${callback} нэмнэ.`
      : error
        ? ERRORS[error]
        : null;

  return (
    <div className="min-h-screen bg-muted/40 flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-xl bg-card p-8 ring-1 ring-foreground/10">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            J→P
          </div>
          <div>
            <h1 className="text-lg font-semibold">Jira → Microsoft Planner</h1>
            <p className="text-xs text-muted-foreground">Ажлын бүртгэлээр нэвтрэх</p>
          </div>
        </div>

        <p className="mb-6 text-sm text-muted-foreground">
          Zerotech-ийн Microsoft бүртгэлээр нэвтэрнэ. Имэйл нь @zerotech.mn байх ёстой.
        </p>

        {message && (
          <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {message}
          </p>
        )}

        <a
          href="/api/auth/microsoft"
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
        >
          @zerotech.mn-ээр нэвтрэх
        </a>
      </div>
    </div>
  );
}
