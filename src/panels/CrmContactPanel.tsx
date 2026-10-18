/**
 * CRM contact side-panel content — the far end of one call, as the CRM sees it.
 *
 * Opened from the Call Logs row action (see `extensions/OpenInCrmAction.tsx`).
 * Flow knows the number and whatever caller-ID name the switch recorded; it does
 * not know the company, when the account was last spoken to, how often they
 * call, or what the account team noted. That is the CRM's data, and putting it
 * one click from the call log is the point of the example.
 *
 * Two states:
 *  - **Match** — the record from `mocks/crm.ts`, looked up under every spelling
 *    of the number (`findCrmRecord`), so `sip:2364@host` and `+15551234567`
 *    both resolve.
 *  - **No match** — a "Create contact" form. The create is mock: the new record
 *    lives in a module-level map in this bundle, survives closing and reopening
 *    the panel for the rest of the session, and is labelled as example data. A
 *    real app would POST to the vendor here, through its own backend.
 */
import type { SidePanelContentProps } from '@netsapiens/flow-sdk';
import { useState } from 'react';

import type { CrmRecord } from '../mocks/crm';
import type { CallParty } from '../services/callParty';
import { crmLookupKeys, findCrmRecord } from '../mocks/crm';

/**
 * Contacts "created" from this panel, keyed by the first lookup key of the
 * number. Module scope, so it outlives the panel component (which unmounts on
 * close) but not a page reload — honest for a mock, and never sent anywhere.
 */
const CREATED = new Map<string, CrmRecord>();

function resolve(number: string): CrmRecord | undefined {
  if (!number) return undefined;
  const hit = findCrmRecord(number);
  if (hit) return hit.record;
  for (const key of crmLookupKeys(number)) {
    const made = CREATED.get(key);
    if (made) return made;
  }
  return undefined;
}

interface CrmContactPanelProps extends SidePanelContentProps {
  party: CallParty;
}

export function CrmContactPanel({
  context,
  close,
  party,
}: CrmContactPanelProps) {
  const { Stack, Typography, Divider, Button, Chip, Alert, TextField } =
    context.ui ?? {};
  const [record, setRecord] = useState(() => resolve(party.number));
  const [name, setName] = useState(party.name);
  const [company, setCompany] = useState('');

  if (!Stack || !Typography) return null;

  const create = () => {
    const made: CrmRecord = {
      name: name.trim() || party.number,
      company: company.trim() || '—',
      lastContact: 'Just now',
      notes: 'Created from a Call Logs row in this demo. Example data only.',
      callCount: 1,
    };
    CREATED.set(crmLookupKeys(party.number)[0], made);
    setRecord(made);
  };

  const facts: [string, string][] = record
    ? [
        ['Company', record.company],
        ['Last contact', record.lastContact],
        ['Calls logged', String(record.callCount)],
        ['Number', party.number],
      ]
    : [];

  return (
    <Stack spacing={2}>
      <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap'>
        <Typography variant='body2' color='text.secondary'>
          {party.direction} call · {party.number || 'no number on this row'}
        </Typography>
        {/* Says plainly that none of this came from Flow or a real CRM. */}
        {Chip ? (
          <Chip size='small' variant='outlined' label='Example data' />
        ) : null}
      </Stack>

      {Divider && <Divider />}

      {record ? (
        <>
          <Stack spacing={0.5}>
            <Typography variant='h6'>{record.name}</Typography>
            <Typography variant='body2' color='text.secondary'>
              {record.company}
            </Typography>
          </Stack>

          <Stack spacing={1.5}>
            {facts.map(([label, value]) => (
              <Stack
                key={label}
                direction='row'
                justifyContent='space-between'
                spacing={2}
              >
                <Typography variant='body2' color='text.secondary'>
                  {label}
                </Typography>
                <Typography
                  variant='body2'
                  fontWeight={600}
                  sx={{ textAlign: 'right' }}
                >
                  {value}
                </Typography>
              </Stack>
            ))}
          </Stack>

          <Stack spacing={0.5}>
            <Typography variant='overline' color='text.secondary'>
              Notes
            </Typography>
            <Typography variant='body2'>{record.notes}</Typography>
          </Stack>
        </>
      ) : (
        <>
          {Alert ? (
            <Alert
              severity='info'
              title='No CRM match'
              message={
                party.number
                  ? `${party.number} is not in the example CRM.`
                  : 'This row carries no number to look up.'
              }
            />
          ) : (
            <Typography variant='body2'>No CRM match</Typography>
          )}

          {party.number && TextField && Button ? (
            <Stack spacing={1.5}>
              <Typography variant='subtitle2'>Create contact</Typography>
              <TextField
                label='Name'
                fullWidth
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 80))}
              />
              <TextField
                label='Company'
                fullWidth
                value={company}
                onChange={(e) => setCompany(e.target.value.slice(0, 80))}
              />
              <Stack direction='row' justifyContent='flex-end'>
                <Button variant='contained' onClick={create}>
                  Create contact
                </Button>
              </Stack>
              <Typography variant='caption' color='text.secondary'>
                Example only: the contact is kept in this browser tab and sent
                nowhere.
              </Typography>
            </Stack>
          ) : null}
        </>
      )}

      {Button && (
        <>
          {Divider && <Divider />}
          <Stack direction='row' spacing={1} justifyContent='flex-end'>
            {/* The CRM's own full view lives on a page this app registers. */}
            {context.navigate ? (
              <Button
                variant='text'
                onClick={() => {
                  close();
                  context.navigate?.('/apps/example-crm');
                }}
              >
                Open Example CRM
              </Button>
            ) : null}
            <Button variant='text' onClick={close}>
              {context.t?.('CLOSE') ?? 'Close'}
            </Button>
          </Stack>
        </>
      )}
    </Stack>
  );
}

export default CrmContactPanel;
