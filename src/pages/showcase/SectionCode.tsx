/**
 * A showcase section's code snippet, together with the rule above it.
 *
 * The pair is one unit: the divider exists to separate the live demo from the
 * snippet, so when the snippet is hidden the divider is a line under nothing.
 * Sections render this instead of a `Divider` plus a kit `Code` so that
 * hiding the code leaves no trace of where it was.
 */
import { useFlowContext } from '@netsapiens/flow-sdk';

import { useShowCode } from './ShowCode';

export function SectionCode({ children }: { children: string }) {
  const { ui } = useFlowContext();
  const Divider = ui?.Divider;
  const Code = ui?.Code;
  const showCode = useShowCode();

  if (!showCode || !Code) return null;

  return (
    <>
      {Divider && <Divider sx={{ my: 3 }} />}
      <Code>{children}</Code>
    </>
  );
}
