import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

// `users.displayName`/`users.avatarUrl` are required app fields (data-model.md
// §users), so the Password provider's `profile` callback must populate them at
// sign-up time from whatever the sign-up form submits (falling back to sensible
// defaults) rather than leaving them unset.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const email = params.email as string;
        const displayName = (params.displayName as string | undefined)?.trim() || email.split("@")[0];
        return {
          email,
          displayName,
          avatarUrl:
            (params.avatarUrl as string | undefined) ||
            `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(email)}`,
        };
      },
    }),
  ],
});
