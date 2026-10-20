"use client";

import * as React from "react";
import { MapPin, MessageCircle, Mail, UserRound, ClipboardList, HandCoins, Check, HeartPulse } from "lucide-react";
import { InvoiceLogo } from "./InvoiceLogo";
import { rupeesInWords } from "@/lib/printing/amount-in-words";
import styles from "./InvoiceDocument.module.css";

export interface InvoiceDocumentData {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string;
  status: string;
  notes?: string | null;
  subtotal?: number | string;
  discountTotal?: number | string;
  taxTotal?: number | string;
  terms?: string | null;
  createdBy?: { name?: string | null } | null;
  paymentAllocations?: Array<{ payment: { status?: string; paymentMethod?: string | null; reference?: string | null } }>;
  total: number | string;
  amountPaid: number | string;
  balanceDue: number | string;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  cashierName?: string | null;
  organization?: { name: string; logoUrl?: string | null } | null;
  customer?: {
    displayName: string;
    legalName?: string | null;
    contactPerson?: string | null;
    email?: string | null;
    phone?: string | null;
    billingAddressLine1?: string | null;
    billingCity?: string | null;
    billingCountry?: string | null;
  } | null;
  lines?: Array<{
    id?: string;
    description: string;
    quantity: number;
    unitPrice: number | string;
    taxRate?: number | string;
    taxAmount?: number | string;
    discount?: number | string;
    total?: number | string;
    unit?: string | null;
    unitOfMeasure?: string | null;
    barcode?: string | null;
    product?: {
      name: string;
      sku: string;
      barcode?: string | null;
      unitOfMeasure?: { symbol: string } | null;
    } | null;
  }>;
}

/** The supplied reference is used only for its medical emblem and delivery illustration.
 * Everything relating to the customer, invoice, products and money is live HTML. */
function ReferenceArtwork({ crop, label, className }: { crop: [number, number, number, number]; label: string; className: string }) {
  const [x, y, width, height] = crop;
  return <div role="img" aria-label={label} className={className} style={{ position: "relative", overflow: "hidden", aspectRatio: `${width} / ${height}` }}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/images/invoice/adcare-artwork.png" alt="" aria-hidden="true" loading="eager" decoding="sync"
      style={{ position: "absolute", maxWidth: "none", width: `${1055 / width * 100}%`, height: "auto", left: `${-x / width * 100}%`, top: `${-y / height * 100}%` }} />
  </div>;
}

const money = (value: number | string) => Number(value).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const paymentLabel = (value: string) => value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

export function InvoiceDocument({ invoice }: { invoice: InvoiceDocumentData }) {
  if (!invoice) return null;
  const date = new Date(invoice.issueDate);
  const validDate = !Number.isNaN(date.getTime());
  const formattedDate = validDate ? date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Karachi" }).replace(/ /g, "-") : "—";
  const formattedTime = validDate ? date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Karachi" }) : "—";
  const lines = invoice.lines || [];
  const subtotal = invoice.subtotal ?? lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unitPrice), 0);
  const discount = invoice.discountTotal ?? lines.reduce((sum, line) => sum + Number(line.discount || 0), 0);
  const tax = invoice.taxTotal ?? lines.reduce((sum, line) => sum + Number(line.taxAmount || 0), 0);
  const total = Number(invoice.total || 0);
  const payments = (invoice.paymentAllocations || []).filter(({ payment }) => payment.status === "COMPLETED");
  const methods = Array.from(new Set(payments.map(({ payment }) => payment.paymentMethod).filter(Boolean))) as string[];
  const method = invoice.paymentMethod ? paymentLabel(invoice.paymentMethod) : methods.length ? methods.map(paymentLabel).join(" / ") : "Not recorded";
  const reference = invoice.paymentReference || payments.map(({ payment }) => payment.reference).filter(Boolean).join(", ");
  const address = [invoice.customer?.billingAddressLine1, invoice.customer?.billingCity, invoice.customer?.billingCountry].filter(Boolean).join(", ") || "—";
  const terms = invoice.terms?.trim();
  return (
    <div id="invoice-printable-area" className={styles.document}>
      <div className={styles.canvas}>
        <div className={styles.top}>
          <div className={styles.brand}>
            <ReferenceArtwork crop={[28, 27, 153, 173]} label="AD CARE pharmacy medical emblem" className={styles.emblem} />
            <div className={styles.wordmark}>
              <h1>AD CARE</h1>
              <h2>Meds &amp; Pharmacy</h2>
              <p>Affordable Medicines <span>|</span> Trusted Care</p>
            </div>
          </div>
          <div className={styles.invoiceIdentity}>
            <InvoiceLogo logoUrl={invoice.organization?.logoUrl} name={invoice.organization?.name || "Business"} />
            <div className={styles.invoiceBox}>
              <h2>TAX INVOICE</h2>
              <dl>
                <div><dt>Invoice No:</dt><dd>{invoice.invoiceNumber || "—"}</dd></div>
                <div><dt>Date:</dt><dd>{formattedDate}</dd></div>
                <div><dt>Time:</dt><dd>{formattedTime}</dd></div>
                <div><dt>Cashier:</dt><dd>{invoice.cashierName || invoice.createdBy?.name || "Shop Owner"}</dd></div>
              </dl>
            </div>
          </div>
        </div>
        <div className={styles.contacts}>
          <span><MapPin />Peshawar, Khyber Pakhtunkhwa</span>
          <span><MessageCircle />WhatsApp: 0342-3010508</span>
          <span><Mail />Email: adcaremeds.pharmacy06@gmail.com</span>
        </div>
        <div className={styles.billTo}>
          <div className={styles.billToTitle}><span><UserRound /></span><strong>Bill To</strong></div>
          <div><b>Name:</b><span>{invoice.customer?.displayName || invoice.customer?.legalName || "—"}</span></div>
          <div><b>Contact:</b><span>{invoice.customer?.phone || "—"}</span></div>
          <div><b>Address:</b><span>{address}</span></div>
        </div>
        <table className={styles.items}>
          <colgroup><col style={{ width: "5%" }} /><col style={{ width: "31%" }} /><col style={{ width: "7.5%" }} /><col style={{ width: "6.5%" }} /><col style={{ width: "13%" }} /><col style={{ width: "12%" }} /><col style={{ width: "12%" }} /><col style={{ width: "13%" }} /></colgroup>
          <thead><tr><th scope="col">#</th><th scope="col">Product Name</th><th scope="col">Unit</th><th scope="col">Qty</th><th scope="col">Unit Price<br />(PKR)</th><th scope="col">Discount<br />(PKR)</th><th scope="col">Tax<br />(PKR)</th><th scope="col">Total<br />(PKR)</th></tr></thead>
          <tbody>{lines.length ? lines.map((item, index) => {
            const quantity = Number(item.quantity);
            const lineTotal = item.total ?? quantity * Number(item.unitPrice) - Number(item.discount || 0) + Number(item.taxAmount || 0);
            return <tr key={item.id || index}>
              <td><span className={styles.rowNumber}>{index + 1}</span></td>
              <td className={styles.productName}>{item.description || item.product?.name || "—"}</td>
              <td>{item.unitOfMeasure || item.unit || item.product?.unitOfMeasure?.symbol || "pcs"}</td>
              <td>{quantity.toLocaleString("en-PK", { maximumFractionDigits: 4 })}</td>
              <td>{money(item.unitPrice)}</td><td>{money(item.discount || 0)}</td><td>{money(item.taxAmount || 0)}</td><td>{money(lineTotal)}</td>
            </tr>;
          }) : <tr><td colSpan={8}>No line items recorded.</td></tr>}</tbody>
        </table>
        <div className={styles.summary}>
          <div className={styles.notesAndPayment}>
            <div className={styles.notes}>
              <h3><span><ClipboardList /></span>Notes / Terms</h3>
              {terms ? <p className={styles.freeText}>{terms}</p> : <ul>
                <li>Goods once sold will not be returned or exchanged.</li>
                <li>Prices subject to change without prior notice.</li>
                <li>Please verify items before leaving.</li>
                <li>Returns within 7 days with original invoice (if applicable).</li>
              </ul>}
              {invoice.notes?.trim() && <p className={styles.freeText}>{invoice.notes}</p>}
            </div>
            <div className={styles.payment}><span className={styles.paymentIcon}><HandCoins /></span><div><h3>Payment Method:</h3><strong>{method}</strong>{reference && <p>Reference: {reference}</p>}</div></div>
          </div>
          <div className={styles.totals}>
            <dl><div><dt>Subtotal (PKR)</dt><dd>{money(subtotal)}</dd></div><div><dt>Discount (PKR)</dt><dd>-{money(discount)}</dd></div><div><dt>Tax (PKR)</dt><dd>{money(tax)}</dd></div><div className={styles.grandTotal}><dt>Grand Total (PKR)</dt><dd>{money(total)}</dd></div></dl>
            <div className={styles.words}><Check /><span>Amount in Words: {rupeesInWords(total)}</span></div>
            <div className={styles.settlement}><span>{invoice.status.replace(/_/g, " ")}</span><span>Paid: PKR {money(invoice.amountPaid || 0)}</span><span>Due: PKR {money(invoice.balanceDue || 0)}</span></div>
          </div>
        </div>
        <div className={styles.footer}>
          <div className={styles.thanks}><p>Thank you for choosing <strong>AD CARE</strong> Meds &amp; Pharmacy</p><div><HeartPulse />Your Health, Our Priority</div><span className={styles.whatsapp}><MessageCircle />WhatsApp: 0342-3010508</span></div>
          <ReferenceArtwork crop={[679, 1250, 366, 231]} label="AD CARE pharmacy delivery van — Delivery All Over Pakistan" className={styles.delivery} />
        </div>
      </div>
    </div>
  );
}
