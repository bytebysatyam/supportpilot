import { PageHeader } from "../../components/ui/states";
import { Metrics } from "../../components/dashboard/metrics";
import { TicketList } from "../../components/tickets/ticket-list";
export default function DashboardPage() {
  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Support queue"
        description="Triage requests, manage ownership, and keep the next response on track."
      />
      <Metrics />
      <TicketList />
    </>
  );
}
