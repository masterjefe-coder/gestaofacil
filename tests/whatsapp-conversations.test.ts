import assert from "node:assert/strict";
import test from "node:test";
import { buildWhatsappConversationSnapshot } from "@/lib/whatsapp-conversations";

test("buildWhatsappConversationSnapshot groups inbound and outbound messages by customer phone", () => {
  const createdAt = new Date("2026-05-26T19:00:00.000Z");
  const conversations = buildWhatsappConversationSnapshot(
    [
      {
        id: "customer-1",
        name: "Loja Ofertas do TON",
        phone: "5547933850510",
      },
    ],
    [
      {
        id: "event-1",
        action: "evolution.messages_upsert",
        entityType: "evolution",
        entityId: "ofertas-do-ton",
        createdAt,
        payload: {
          summary: "Nova mensagem recebida na instancia ofertas-do-ton: preciso de ajuda",
          metadata: {
            remoteJid: "5547933850510@s.whatsapp.net",
            messagePreview: "preciso de ajuda",
          },
        },
      },
      {
        id: "event-2",
        action: "customer.whatsapp.sent",
        entityType: "customer",
        entityId: "customer-1",
        createdAt: new Date("2026-05-26T19:05:00.000Z"),
        payload: {
          summary: "Mensagem manual enviada para Loja Ofertas do TON.",
          metadata: {
            customer: "Loja Ofertas do TON",
            phone: "5547933850510",
            message: "Ja vou te responder por aqui.",
          },
        },
      },
    ],
  );

  assert.equal(conversations.length, 1);
  assert.equal(conversations[0]?.customerId, "customer-1");
  assert.equal(conversations[0]?.customerName, "Loja Ofertas do TON");
  assert.equal(conversations[0]?.inboundCount, 1);
  assert.equal(conversations[0]?.outboundCount, 1);
  assert.equal(conversations[0]?.pendingReply, false);
  assert.equal(conversations[0]?.messages[0]?.direction, "outbound");
  assert.equal(conversations[0]?.messages[1]?.direction, "inbound");
});

test("buildWhatsappConversationSnapshot ignores events without resolvable phone", () => {
  const conversations = buildWhatsappConversationSnapshot(
    [],
    [
      {
        id: "event-1",
        action: "evolution.messages_upsert",
        entityType: "evolution",
        entityId: "instance-1",
        createdAt: new Date("2026-05-26T19:00:00.000Z"),
        payload: {
          summary: "Mensagem sem telefone resolvivel",
          metadata: {},
        },
      },
    ],
  );

  assert.equal(conversations.length, 0);
});
