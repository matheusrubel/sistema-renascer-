import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "./app-shell";
import { DialogosProvider } from "@/components/dialogos";
import { CalendarioGlobal } from "@/components/calendario-global";

export const metadata: Metadata = {
  title: "Sistema Renascer",
  description: "Gestão social do Instituto de Ação Social Renascer",
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: "try{if(localStorage.getItem('renascer.sidebar.fixa')==='1')document.documentElement.dataset.sidebar='aberta'}catch(e){}" }} /></head>
    <body><DialogosProvider><AppShell>{children}</AppShell></DialogosProvider><CalendarioGlobal /></body>
  </html>;
}
