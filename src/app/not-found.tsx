import Link from "next/link";
import { Divider, Heading } from "@/components/ui/Glyphs";

export default function NotFound() {
  return (
    <div className="page center" style={{ display: "grid", placeItems: "center" }}>
      <div className="stack">
        <Heading as="h1" runes="Lost" title="Lost in the Mist" size="xl" lead="This path isn't on the map. Even great explorers take a wrong turn." divider={false} />
        <Divider variant="notched" />
        <Link href="/" className="btn primary">
          Return to Base Camp
        </Link>
      </div>
    </div>
  );
}
