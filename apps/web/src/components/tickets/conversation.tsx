import type { TicketMessage } from "@supportpilot/types";
import { formatDate, initials } from "../../lib/format";
import { EmptyState } from "../ui/states";
export function Conversation({ messages }: { messages: TicketMessage[] }) {
  return (
    <section aria-label="Ticket conversation" className="conversation">
      {!messages.length ? (
        <EmptyState title="The conversation starts here">
          Replies from you and the support team will appear here.
        </EmptyState>
      ) : (
        messages.map((message) => (
          <article
            className={`message ${message.isInternal ? "internal-note" : ""}`}
            key={message.id}
          >
            <header>
              <span
                className={`avatar ${message.authorType === "AGENT" ? "avatar-agent" : ""}`}
              >
                {initials(message.author?.name ?? "System")}
              </span>
              <div>
                <strong>{message.author?.name ?? "System"}</strong>
                <span>
                  {message.isInternal
                    ? "Internal note · staff only"
                    : message.authorType === "AGENT"
                      ? "Support team"
                      : "Customer"}
                </span>
              </div>
              <time dateTime={message.createdAt}>
                {formatDate(message.createdAt)}
              </time>
            </header>
            <p className="message-body">{message.body}</p>
          </article>
        ))
      )}
    </section>
  );
}
