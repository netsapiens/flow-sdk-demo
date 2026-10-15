/** DemoPage tab: Route Patterns — how extensions target host pages. */
import { useFlowContext } from '@netsapiens/flow-sdk';

import { PATTERNS } from '../../content/demoContent';

const HEADINGS = ['Pattern', 'Type', 'Example match'];

export default function PatternsPanel() {
  const { ui } = useFlowContext();
  const {
    Paper,
    Typography,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
  } = ui || {};
  if (
    !Paper ||
    !Typography ||
    !Table ||
    !TableHead ||
    !TableBody ||
    !TableRow ||
    !TableCell
  ) {
    return null;
  }

  return (
    <Paper rounded>
      <Typography variant='h6' gutterBottom>
        Route pattern matching
      </Typography>
      <Typography variant='body2' color='text.secondary' sx={{ mb: 3 }}>
        Each extension lists the routes it applies to. Patterns support
        wildcards, named params, prefixes, and a global match — so one
        registration can target many pages.
      </Typography>

      {/* The kit has no TableContainer; a Paper with overflowX is all it did. */}
      <Paper rounded background={1} sx={{ overflowX: 'auto' }}>
        <Table size='small'>
          <TableHead>
            <TableRow>
              {HEADINGS.map((heading) => (
                <TableCell key={heading}>{heading}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {PATTERNS.map((p) => (
              <TableRow key={p.pattern}>
                <TableCell>
                  <code>{p.pattern}</code>
                </TableCell>
                <TableCell>{p.kind}</TableCell>
                <TableCell>
                  <Typography variant='body2' color='text.secondary'>
                    {p.matches}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Paper>
  );
}
