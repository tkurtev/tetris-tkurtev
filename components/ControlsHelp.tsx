import { TechPanel } from "./TechPanel";

export const KEY_BINDINGS: Array<{ keys: string[]; action: string }> = [
  { keys: ["←", "→"], action: "Move" },
  { keys: ["↓"], action: "Soft drop" },
  { keys: ["Space"], action: "Hard drop" },
  { keys: ["↑", "X"], action: "Rotate" },
  { keys: ["Z"], action: "Rotate left" },
  { keys: ["C", "Shift"], action: "Hold" },
  { keys: ["P", "Esc"], action: "Pause" },
  { keys: ["R"], action: "Restart" },
  { keys: ["M"], action: "Mute" },
];

export function KeyList({ bindings = KEY_BINDINGS }: { bindings?: typeof KEY_BINDINGS }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-[7px]">
      {bindings.map(({ keys, action }) => (
        <div key={action} className="contents">
          <dt className="flex gap-1">
            {keys.map((key) => (
              <kbd key={key} className="kbd">
                {key}
              </kbd>
            ))}
          </dt>
          <dd className="text-right text-[10px] font-semibold tracking-[0.16em] text-fg-muted uppercase">
            {action}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ControlsHelp({ className = "" }: { className?: string }) {
  return (
    <TechPanel label="Controls" meta="KEYS" className={className}>
      <KeyList />
    </TechPanel>
  );
}
