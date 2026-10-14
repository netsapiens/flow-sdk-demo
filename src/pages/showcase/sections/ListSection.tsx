/** Showcase section: List primitives and the Code surface. */
import { useFlowContext } from '@netsapiens/flow-sdk';

import { SectionCode } from '../SectionCode';

export default function ListSection() {
  const { ui } = useFlowContext();
  const { List, ListItem, ListItemText, Code, Typography, Paper, Box } =
    ui || {};
  if (!Paper || !Typography || !List || !ListItem || !ListItemText) return null;

  return (
    <Paper rounded>
      <Typography variant='h5' gutterBottom>
        List &amp; Code
      </Typography>
      <Typography variant='body2' color='text.secondary' sx={{ mb: 3 }}>
        <code>List &gt; ListItem &gt; ListItemText</code> for ordered or
        unordered sequences, and a monospace surface that follows the colour
        mode.
      </Typography>

      {/* The kit's List clears the browser's markers, so an ordered list needs
          its numbering asked for explicitly — otherwise `component='ol'` is
          semantics with nothing on screen to match. */}
      <List
        component='ol'
        sx={{ listStyle: 'decimal', pl: 3, '& > li': { display: 'list-item' } }}
      >
        <ListItem component='li'>
          <ListItemText
            primary='Request a token'
            secondary='auth.requestRemoteAuth()'
          />
        </ListItem>
        <ListItem component='li'>
          <ListItemText
            primary='Call your backend'
            secondary='The host never sees the vendor credential'
          />
        </ListItem>
        <ListItem component='li'>
          <ListItemText
            primary='Render the result'
            secondary='Through context.ui, so it matches Flow'
          />
        </ListItem>
      </List>

      {Code && Box ? (
        <Box sx={{ mt: 2 }}>
          <Typography variant='body2' sx={{ mb: 1 }}>
            Inline: call <Code inline>requestRemoteAuth()</Code> and await it.
          </Typography>
          <Code>{`const { token } = await auth.requestRemoteAuth('example-crm');`}</Code>
        </Box>
      ) : null}

      <SectionCode>
        {`const { List, ListItem, ListItemText, Code } = flowContext.ui;

// component='ol' is the semantics; the sx is what draws the numbers.
<List component="ol" sx={{ listStyle: 'decimal', pl: 3,
                           '& > li': { display: 'list-item' } }}>
  <ListItem component="li">
    <ListItemText primary="Request a token" secondary="auth.requestRemoteAuth()" />
  </ListItem>
</List>

<Code inline>requestRemoteAuth()</Code>
<Code>{\`const { token } = await auth.requestRemoteAuth('example-crm');\`}</Code>`}
      </SectionCode>

      <Typography
        variant='caption'
        color='text.secondary'
        sx={{ mt: 2, display: 'block' }}
      >
        💡 <code>Code</code> is themed for both colour modes, so it follows the
        toggle. It deliberately does not highlight or re-indent what you pass,
        and the block form scrolls sideways rather than wrapping — a wrapped
        line of code reads as two statements.
      </Typography>
    </Paper>
  );
}
