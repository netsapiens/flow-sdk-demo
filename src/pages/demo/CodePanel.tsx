/** DemoPage tab: Code — the registration snippets this demo uses. */
import { useFlowContext } from '@netsapiens/flow-sdk';

import { CODE_EXAMPLES } from '../../content/demoContent';

export default function CodePanel() {
  const { ui } = useFlowContext();
  const { Paper, Stack, Typography, Code } = ui || {};
  if (!Paper || !Stack || !Typography || !Code) return null;

  return (
    <Paper rounded>
      <Typography variant='h6' sx={{ mb: 3 }}>
        How this demo registers
      </Typography>

      <Stack spacing={3}>
        {CODE_EXAMPLES.map((example) => (
          <Stack key={example.title} spacing={1}>
            <Typography variant='subtitle2' fontWeight={600}>
              {example.title}
            </Typography>
            <Code>{example.code}</Code>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}
