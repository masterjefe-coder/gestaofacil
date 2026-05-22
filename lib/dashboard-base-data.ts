import { cache } from "react";
import { listChargeWhatsappSignals } from "@/lib/charge-whatsapp-signals";
import { listCustomerWhatsappActivity } from "@/lib/customer-whatsapp-activity";
import { buildFiscalInsights } from "@/lib/fiscal-insights";
import { listCharges } from "@/lib/charge-repository";
import { listCustomers } from "@/lib/customer-repository";
import { getNfseNationalIssuePreview, listNfseDocuments, listNfseReadyQueue } from "@/lib/nfse-repository";
import { listOrders } from "@/lib/order-repository";
import { listQuotes } from "@/lib/quote-repository";

export type DashboardBaseData = {
  customers: Awaited<ReturnType<typeof listCustomers>>;
  quotes: Awaited<ReturnType<typeof listQuotes>>;
  charges: Awaited<ReturnType<typeof listCharges>>;
  orders: Awaited<ReturnType<typeof listOrders>>;
  nfseDocuments: Awaited<ReturnType<typeof listNfseDocuments>>;
  nfseReadyQueue: Awaited<ReturnType<typeof listNfseReadyQueue>>;
  chargeWhatsappSignals: Awaited<ReturnType<typeof listChargeWhatsappSignals>>;
  customerWhatsappActivity: Awaited<ReturnType<typeof listCustomerWhatsappActivity>>;
  fiscalInsights: ReturnType<typeof buildFiscalInsights>;
};

export const getDashboardBaseData = cache(async (): Promise<DashboardBaseData> => {
  const [customers, quotes, charges, orders, nfseDocuments, nfseReadyQueue, chargeWhatsappSignals, customerWhatsappActivity] = await Promise.all([
    listCustomers(),
    listQuotes(),
    listCharges(),
    listOrders(),
    listNfseDocuments(),
    listNfseReadyQueue(),
    listChargeWhatsappSignals().catch(() => []),
    listCustomerWhatsappActivity().catch(() => []),
  ]);

  const nfsePreviewEntries = await Promise.all(
    nfseDocuments.map(async (document) => [document.id, await getNfseNationalIssuePreview(document.id)] as const),
  );
  const fiscalInsights = buildFiscalInsights(nfseDocuments, new Map(nfsePreviewEntries));

  return {
    customers,
    quotes,
    charges,
    orders,
    nfseDocuments,
    nfseReadyQueue,
    chargeWhatsappSignals,
    customerWhatsappActivity,
    fiscalInsights,
  };
});
