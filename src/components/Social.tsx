import { site } from "@/lib/site";

export function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

export function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21.94 4.3 18.7 19.6c-.24 1.07-.88 1.34-1.78.83l-4.93-3.63-2.38 2.29c-.26.26-.48.48-.99.48l.35-5.02 9.14-8.26c.4-.35-.09-.55-.62-.2L6.2 13.2l-4.86-1.52c-1.06-.33-1.08-1.06.22-1.57L20.55 2.8c.88-.33 1.65.2 1.39 1.5Z" />
    </svg>
  );
}

export function WhatsappIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35ZM12.04 21.5h-.01a9.47 9.47 0 0 1-4.83-1.32l-.35-.21-3.59.94.96-3.5-.23-.36a9.44 9.44 0 0 1-1.45-5.04c0-5.22 4.25-9.47 9.48-9.47a9.43 9.43 0 0 1 9.47 9.48c0 5.22-4.25 9.48-9.45 9.48Zm8.06-17.54A11.33 11.33 0 0 0 12.04.62C5.76.62.65 5.73.65 12.01c0 2 .52 3.96 1.52 5.69L.55 23.6l6.04-1.58a11.37 11.37 0 0 0 5.44 1.39h.01c6.28 0 11.39-5.11 11.39-11.39 0-3.04-1.18-5.9-3.33-8.05Z" />
    </svg>
  );
}

export const socialLinks = [
  { key: "x", ...site.socials.x, Icon: XIcon },
  { key: "telegram", ...site.socials.telegram, Icon: TelegramIcon },
  { key: "whatsapp", ...site.socials.whatsapp, Icon: WhatsappIcon },
];

export function SocialRow() {
  return (
    <div className="socials">
      {socialLinks.map(({ key, label, url, Icon }) =>
        url ? (
          <a key={key} className="social" href={url} target="_blank" rel="noopener noreferrer" aria-label={label}>
            <Icon />
          </a>
        ) : (
          <span key={key} className="social disabled" aria-label={`${label} (link coming soon)`} title={`${label}: link coming soon`}>
            <Icon />
          </span>
        )
      )}
    </div>
  );
}
