import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { verifyFirebaseToken } from "./firebase-admin";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", optional: true },
        password: { label: "Password", type: "password", optional: true },
        token: { label: "Token", type: "text", optional: true }
      },
      async authorize(credentials) {
        // Firebase Auth Verification (Google Sign In)
        if (credentials?.token) {
          const decoded = await verifyFirebaseToken(credentials.token)
          if (!decoded?.email) {
            throw new Error("Invalid Firebase token")
          }

          const user = await prisma.user.findUnique({
            where: { email: decoded.email }
          })

          if (!user) {
            throw new Error("This email is not registered on PetFlow. Please contact your administrator.")
          }

          if (user.status === 'Inactive') {
            throw new Error("Your account has been deactivated. Please contact support.")
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            tenantId: user.tenantId,
          }
        }

        // Standard Credentials Verification
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing email or password");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        if (!user) {
          throw new Error("Invalid credentials");
        }

        if (user.status === 'Inactive') {
          throw new Error("Your account has been deactivated. Please contact support.");
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

        if (!isPasswordValid) {
          throw new Error("Invalid credentials");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // On initial sign-in
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.email = user.email;
        token.name = user.name;
        token.tenantId = (user as any).tenantId;
      }
      // On explicit session update (e.g. after profile change) OR every refresh
      // Re-fetch the user from DB to always get the latest email/name/role
      if (trigger === 'update' || token.id) {
        try {
          const freshUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { id: true, email: true, name: true, role: true, tenantId: true, status: true }
          });
          if (freshUser) {
            if (freshUser.status === 'Inactive') {
              return {} as any;
            }
            token.id = freshUser.id;
            token.email = freshUser.email;
            token.name = freshUser.name;
            token.role = freshUser.role;
            token.tenantId = freshUser.tenantId;
          }
        } catch { }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id && session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).tenantId = token.tenantId;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
      } else {
        return {} as any;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
