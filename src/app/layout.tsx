import type { Metadata } from "next";
import { Instrument_Serif, Manrope } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/components/app-provider";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { PageMotion } from "@/components/page-motion";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-instrument" });

export const metadata: Metadata = {
  title: { default: "ZoneMart — Find it in your zone", template: "%s · ZoneMart" },
  description: "Discover and reserve products at trusted stores in your zone.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${instrument.variable}`}>
        <AppProvider>
          <Header />
          <main><PageMotion>{children}</PageMotion></main>
          <Footer />
        </AppProvider>
      </body>
    </html>
  );
}
