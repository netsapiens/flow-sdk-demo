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
 *  - **No match** — a "Create contact" form that saves a real Flow contact,
 *    through the host's authenticated API proxy: `POST /domains/{domain}/users/
 *    {ext}/contacts` for the user's own contacts, or `/users/domain/contacts`
 *    for the domain's shared ones (the server stamps it shared from that path
 *    segment, exactly as Flow's own Add contact form does). The panel then
 *    shows the new contact, and remembers it for the rest of the session.
 */
import type { SidePanelContentProps } from '@netsapiens/flow-sdk';
import { useState } from 'react';

import type { CrmRecord } from '../mocks/crm';
import type { CallParty } from '../services/callParty';
import { appApi, appUserExtension } from '../integration/appSdk';
import { crmLookupKeys, findCrmRecord } from '../mocks/crm';

/**
 * Contacts created from this panel, keyed by the first lookup key of the
 * number. Module scope, so reopening the panel shows the contact just saved
 * (it outlives the panel component, which unmounts on close) without a lookup.
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

/** The API's limit on a contact's notes. */
const NOTES_MAX = 256;

interface CrmContactPanelProps extends SidePanelContentProps {
  party: CallParty;
}

export function CrmContactPanel({
  context,
  close,
  party,
}: CrmContactPanelProps) {
  const {
    Stack,
    Typography,
    Divider,
    Button,
    Chip,
    Alert,
    TextField,
    RadioGroup,
  } = context.ui ?? {};
  const [record, setRecord] = useState(() => resolve(party.number));
  const [name, setName] = useState(party.name);
  const [company, setCompany] = useState('');
  const [notes, setNotes] = useState('');
  const [saveTo, setSaveTo] = useState<'personal' | 'shared'>('personal');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!Stack || !Typography) return null;

  // Personal contacts belong to the signed-in user, so they need an extension;
  // shared ones go to the domain being managed, else the user's own.
  const ownExtension = appUserExtension.current;
  const sharedDomain = context.managing || context.user.domain;
  const canSavePersonal = !!ownExtension;
  const target =
    saveTo === 'personal' && canSavePersonal ? 'personal' : 'shared';

  const create = async () => {
    const api = appApi.current;
    if (!api) {
      setError('The host has not handed this app its API client.');
      return;
    }
    const domain = target === 'personal' ? context.user.domain : sharedDomain;
    // The literal user segment `domain` is what makes a contact shared.
    const user = target === 'personal' ? ownExtension! : 'domain';
    const [first = '', ...rest] = (name.trim() || party.number).split(/\s+/);
    setSaving(true);
    setError('');
    try {
      await api.post(
        `/domains/${encodeURIComponent(domain)}/users/${encodeURIComponent(user)}/contacts`,
        {
          domain,
          'name-first-name': first,
          'name-last-name': rest.join(' '),
          company: company.trim(),
          notes: notes.trim(),
          'phonenumber-work': party.number,
          groups: [],
        },
      );
      const made: CrmRecord = {
        name: name.trim() || party.number,
        company: company.trim() || '—',
        lastContact: 'Just now',
        notes:
          notes.trim() ||
          (target === 'personal'
            ? 'Saved to your Flow contacts from a Call Logs row.'
            : `Saved to the shared contacts of ${domain} from a Call Logs row.`),
        callCount: 1,
      };
      CREATED.set(crmLookupKeys(party.number)[0], made);
      setRecord(made);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'The contact could not be saved.',
      );
    } finally {
      setSaving(false);
    }
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
              {/* The API caps a contact's notes at 256 characters; longer is a 400. */}
              <TextField
                label='Notes'
                fullWidth
                multiline
                minRows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, NOTES_MAX))}
                helperText={`${notes.length}/${NOTES_MAX}`}
              />
              {RadioGroup ? (
                <RadioGroup
                  label='Save to'
                  value={target}
                  onChange={(e) =>
                    setSaveTo(e.target.value as 'personal' | 'shared')
                  }
                  options={[
                    ...(canSavePersonal
                      ? [{ value: 'personal', label: 'My contacts' }]
                      : []),
                    {
                      value: 'shared',
                      label: `Shared contacts (${sharedDomain})`,
                    },
                  ]}
                />
              ) : null}
              {error && Alert ? (
                <Alert severity='error' title='Not saved' message={error} />
              ) : null}
              <Stack direction='row' justifyContent='flex-end'>
                <Button
                  variant='contained'
                  onClick={() => void create()}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Create contact'}
                </Button>
              </Stack>
              <Typography variant='caption' color='text.secondary'>
                Saves a real contact in Flow, with this number as its work
                phone.
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
