import type { Customer, Quote } from "@/lib/types";

export type CustomerOutreachTemplate = {
  title: string;
  message: string;
  channelLabel: string;
};

export function buildQuoteFollowUpTemplate(input: {
  quote: Quote;
  customer?: Customer;
}): CustomerOutreachTemplate {
  return {
    title: `Follow-up de proposta para ${input.quote.customer}`,
    channelLabel: "WhatsApp comercial",
    message: [
      `Oi, ${input.quote.customer}.`,
      `Passando para retomar a proposta "${input.quote.title}" no valor de ${input.quote.amount}.`,
      input.quote.summary ? `${input.quote.summary}` : "",
      `Se fizer sentido, posso seguir com os próximos passos ainda hoje.`,
    ].filter(Boolean).join(" "),
  };
}

export function buildCustomerReactivationTemplate(customer: Customer): CustomerOutreachTemplate {
  return {
    title: `Reativação de ${customer.name}`,
    channelLabel: "WhatsApp de reativação",
    message: [
      `Oi, ${customer.name}.`,
      "Passando para retomar nosso contato e entender se existe alguma demanda em que eu possa te ajudar agora.",
      customer.note ? `Lembrei do seu contexto: ${customer.note}` : "",
      "Se quiser, eu já posso te propor um próximo passo simples por aqui.",
    ].filter(Boolean).join(" "),
  };
}
