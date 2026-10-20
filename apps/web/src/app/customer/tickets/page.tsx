import Link from "next/link";
import { PageHeader } from "../../../components/ui/states";
import { TicketList } from "../../../components/tickets/ticket-list";
export default function CustomerTicketsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Customer portal"
        title="Your support requests"
        description="Follow progress, share context, and talk with our team."
        actions={
          <Link className="button button-primary" href="/customer/tickets/new">
            + New request
          </Link>
        }
      />
      <TicketList customer />
    </>
  );
}
