import Link from "next/link";
import { Pill, ShieldCheck, Truck, Lock, PhoneCall, Mail, MapPin } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 text-sm border-t border-slate-800">
      {/* Trust Highlights */}
      <div className="border-b border-slate-800 py-8 bg-slate-950/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-teal-900/60 text-teal-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-white text-xs">Licensed Pharmacists</h4>
              <p className="text-[11px] text-slate-400">All Rx orders verified by licensed pharmacy staff</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-teal-900/60 text-teal-400 flex items-center justify-center shrink-0">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-white text-xs">100% Genuine Medicines</h4>
              <p className="text-[11px] text-slate-400">Direct from certified pharmaceutical manufacturers</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-teal-900/60 text-teal-400 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-white text-xs">Secure Pharmacy Delivery</h4>
              <p className="text-[11px] text-slate-400">Temperature-controlled packaging for sensitive meds</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-teal-900/60 text-teal-400 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-white text-xs">Encrypted Payments</h4>
              <p className="text-[11px] text-slate-400">256-bit SSL secure checkout & data privacy</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 md:grid-cols-5 gap-8">
        {/* Brand Info */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 shrink-0 bg-white p-1 rounded-xl">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <path d="M 18,38 H 38 V 18 H 50 V 82 H 38 V 62 H 18 Z" fill="#62B834" />
                <path d="M 50,18 H 62 V 38 H 82 V 62 H 62 V 82 H 50 Z" fill="#3B5488" />
                <circle cx="50" cy="50" r="15" fill="white" />
                <path d="M 43,50 H 57 M 50,43 V 57" stroke="#3B5488" strokeWidth="4.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex flex-col justify-center">
              <div className="text-lg font-extrabold tracking-tight leading-none flex items-center">
                <span className="text-white">AD&nbsp;</span>
                <span className="text-[#62B834]">CARE</span>
              </div>
              <span className="text-[11px] font-bold text-teal-200 tracking-tight block mt-0.5">
                Meds & Pharmacy
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
            AD CARE Meds & Pharmacy is a licensed online pharmacy platform dedicated to providing safe, convenient, and reliable access to prescription medicines, OTC remedies, vitamins, skincare, and healthcare products.
          </p>
          <div className="text-xs text-slate-400 space-y-1.5 pt-2">
            <div className="flex items-center space-x-2">
              <PhoneCall className="w-3.5 h-3.5 text-teal-400" />
              <span>Customer Care: 1-800-555-MEDS (6337)</span>
            </div>
            <div className="flex items-center space-x-2">
              <Mail className="w-3.5 h-3.5 text-teal-400" />
              <span>Support: support@adcaremeds.com</span>
            </div>
          </div>
        </div>

        {/* Categories */}
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Shop Categories</h3>
          <ul className="space-y-2 text-xs text-slate-400">
            <li><Link href="/categories/medicines" className="hover:text-teal-400">Medicines</Link></li>
            <li><Link href="/categories/otc-products" className="hover:text-teal-400">OTC Products</Link></li>
            <li><Link href="/categories/prescription-medicines" className="hover:text-teal-400">Prescription Medicines</Link></li>
            <li><Link href="/categories/vitamins-supplements" className="hover:text-teal-400">Vitamins & Supplements</Link></li>
            <li><Link href="/categories/skincare" className="hover:text-teal-400">Skincare</Link></li>
            <li><Link href="/categories/medical-devices" className="hover:text-teal-400">Medical Devices</Link></li>
            <li><Link href="/categories/baby-mother-care" className="hover:text-teal-400">Baby & Mother Care</Link></li>
          </ul>
        </div>

        {/* Customer Care */}
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Customer Account</h3>
          <ul className="space-y-2 text-xs text-slate-400">
            <li><Link href="/account/orders" className="hover:text-teal-400">Order History</Link></li>
            <li><Link href="/prescriptions/upload" className="hover:text-teal-400">Upload Prescription</Link></li>
            <li><Link href="/account/prescriptions" className="hover:text-teal-400">Prescription Verification</Link></li>
            <li><Link href="/account/refill-reminders" className="hover:text-teal-400">Refill Reminders</Link></li>
            <li><Link href="/account/addresses" className="hover:text-teal-400">Delivery Addresses</Link></li>
            <li><Link href="/account/support" className="hover:text-teal-400">Customer Support Desk</Link></li>
          </ul>
        </div>

        {/* Pharmacy Legal & Info */}
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Pharmacy & Legal</h3>
          <ul className="space-y-2 text-xs text-slate-400">
            <li><Link href="/privacy" className="hover:text-teal-400">Privacy Policy</Link></li>
            <li><Link href="/terms" className="hover:text-teal-400">Terms of Service</Link></li>
            <li><Link href="/contact" className="hover:text-teal-400">Pharmacy License & Contact</Link></li>
            <li><Link href="/offers" className="hover:text-teal-400">Offers & Discounts</Link></li>
            <li className="pt-2 border-t border-slate-800"><Link href="/admin" className="hover:text-amber-300 font-bold text-amber-400">⚡ Admin Control Panel</Link></li>
          </ul>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-slate-800 py-4 text-center text-[11px] text-slate-500">
        <p>© {new Date().getFullYear()} AD CARE Meds & Pharmacy Platform. All rights reserved. Registered & Licensed Pharmacy Platform.</p>
      </div>
    </footer>
  );
}
