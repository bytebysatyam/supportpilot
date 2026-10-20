import { TicketDetail } from "../../../../components/tickets/ticket-detail";
export default async function CustomerTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TicketDetail key={id} id={id} customer />;
}
