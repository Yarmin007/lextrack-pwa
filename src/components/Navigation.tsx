"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, Banknote, Calculator, ShoppingCart, 
  Flame, Gamepad2, User2, Wallet, Settings 
} from "lucide-react";

export default function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Tracker", href: "/tracker", icon: Banknote },
    { name: "Splitter", href: "/splitter", icon: Calculator },
    { name: "Clearing", href: "/shop-clearing", icon: ShoppingCart },
    { name: "Activities", href: "/activities", icon: Flame },
    { name: "Gaming Hub", href: "/gaming", icon: Gamepad2 },
    { name: "Myself", href: "/myself", icon: User2 },
  ];

  return (
    <>
      {/* PC DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex w-72 bg-white border-r border-slate-200/80 flex-col p-6 sticky top-0 h-screen shrink-0 z-40">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white font-black shadow-md">
            L
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-900 leading-none">Lextrack</h1>
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400 mt-1">LexCorp System</p>
          </div>
        </div>

        <nav className="space-y-1 grow">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  isActive
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon size={18} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <button className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors duration-150">
          <Settings size={18} /> Settings
        </button>
      </aside>

      {/* MOBILE FLOATING BOTTOM DOCKBAR */}
      <nav className="lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 w-[95%] max-w-[420px] h-14 bg-white/95 border border-slate-200/80 shadow-[0_8px_30px_rgba(0,0,0,0.08)] rounded-2xl flex justify-between items-center px-2 z-[100] backdrop-blur-md">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex justify-center transition-transform active:scale-95 ${
                isActive ? "text-slate-900" : "text-slate-400 hover:text-slate-800"
              }`}
            >
              <Icon
                size={18}
                className={isActive ? "bg-slate-100 p-1.5 w-7 h-7 rounded-lg" : ""}
              />
            </Link>
          );
        })}
      </nav>
    </>
  );
}