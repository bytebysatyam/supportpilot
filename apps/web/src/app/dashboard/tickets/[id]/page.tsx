import { TicketDetail } from "../../../../components/tickets/ticket-detail";
export default async function StaffTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TicketDetail key={id} id={id} />;
}
