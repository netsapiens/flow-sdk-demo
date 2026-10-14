/**
 * Showcase section: Avatar — and the demo's clearest use of `flowContext.api`.
 *
 * The signed-in user's photo is not on the context. `FlowUser` carries
 * displayName, domain, email, extension, scope, department and site, and the
 * platform holds the avatar behind an API call, so an app that wants the picture
 * fetches it — through its own audited proxy, with the fields it was already
 * given. That makes this section two demonstrations for the price of one: the
 * `Avatar` component, and a real read against the NetSapiens v2 API.
 */
import { useEffect, useState } from 'react';
import { useFlowContext } from '@netsapiens/flow-sdk';

import { SectionCode } from '../SectionCode';

/**
 * The avatar endpoint answers with a list of renditions rather than a URL, and
 * `path-large` is the one worth showing at any size this section draws.
 */
interface AvatarRendition {
  'path-large'?: string;
}

/**
 * First letter of the first two words — "Andrew Lighterink" → "AL".
 *
 * The same treatment the host's own top-bar avatar uses, which matters: an
 * avatar an app draws for the signed-in user sits a few pixels from the one
 * Flow draws, and two different abbreviations of the same name is the kind
 * of thing nobody reports and everybody notices.
 */
function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

export default function AvatarSection() {
  const { api, ui, user } = useFlowContext();
  const { Avatar, Box, Typography, Stack, Paper } = ui || {};

  const [photo, setPhoto] = useState<string | null>(null);
  const domain = user?.domain;
  const extension = user?.extension;

  useEffect(() => {
    if (!api || !domain || !extension) return;

    let cancelled = false;
    api
      .get<AvatarRendition[]>(`/domains/${domain}/users/${extension}/avatar`)
      .then((renditions) => {
        if (cancelled) return;
        setPhoto(renditions?.[0]?.['path-large'] ?? null);
      })
      // A missing avatar is a 404, not a failure worth showing: `Avatar` falls
      // back to the initials underneath it and the section reads the same.
      .catch(() => {
        if (!cancelled) setPhoto(null);
      });

    return () => {
      cancelled = true;
    };
  }, [api, domain, extension]);

  if (!Paper || !Typography || !Stack || !Avatar || !Box) return null;

  return (
    <Paper rounded>
      <Typography variant='h5' gutterBottom>
        Avatar
      </Typography>
      <Typography variant='body2' color='text.secondary' sx={{ mb: 3 }}>
        Initials in three sizes, the platform's semantic colours, the signed-in
        user drawn from real session data, and a stacked group for when several
        people share a row.
      </Typography>

      <Stack spacing={2.5}>
        <Box>
          <Typography variant='subtitle2' gutterBottom>
            Sizes
          </Typography>
          <Stack direction='row' spacing={1} alignItems='center'>
            <Avatar sx={{ width: 24, height: 24, fontSize: 11 }}>JD</Avatar>
            <Avatar>JD</Avatar>
            <Avatar sx={{ width: 56, height: 56, fontSize: 22 }}>JD</Avatar>
          </Stack>
        </Box>

        <Box>
          <Typography variant='subtitle2' gutterBottom>
            Colour and content
          </Typography>
          <Stack direction='row' spacing={1} alignItems='center'>
            <Avatar sx={{ bgcolor: 'primary.main' }}>AB</Avatar>
            <Avatar sx={{ bgcolor: 'success.main' }}>CD</Avatar>
            <Avatar sx={{ bgcolor: 'warning.main' }}>EF</Avatar>
          </Stack>
        </Box>

        <Box>
          <Typography variant='subtitle2' gutterBottom>
            The signed-in user
          </Typography>
          <Typography variant='caption' color='text.secondary'>
            Fetched with <code>flowContext.api</code>, falling back to initials.
          </Typography>
          <Stack
            direction='row'
            spacing={1.5}
            alignItems='center'
            sx={{ mt: 1 }}
          >
            {/* `src` on top, initials as the child: MUI renders the image when
                it loads and falls through to the letters when it does not, so
                there is no loading flicker and no broken-image icon. */}
            <Avatar
              src={photo ?? undefined}
              alt={user?.displayName ?? 'Signed-in user'}
            >
              {initialsOf(user?.displayName ?? '')}
            </Avatar>
            <Stack direction='column' spacing={0.25}>
              <Typography variant='subtitle2'>
                {user?.displayName ?? 'Unknown user'}
              </Typography>
              <Typography variant='caption' color='text.secondary'>
                {user?.email ?? user?.domain ?? ''}
              </Typography>
            </Stack>
          </Stack>
        </Box>

        <Box>
          <Typography variant='subtitle2' gutterBottom>
            Overlapping group
          </Typography>
          <Stack direction='row' sx={{ pl: 0.5 }}>
            {['JD', 'AB', 'CD', '+4'].map((initials, index) => (
              <Avatar
                key={initials}
                sx={{
                  width: 32,
                  height: 32,
                  fontSize: 13,
                  ml: index === 0 ? 0 : -1,
                  border: '2px solid',
                  borderColor: 'background.paper',
                  // A neutral background needs a colour to go with it. The
                  // Avatar's default text colour is picked to sit on a SATURATED
                  // fill, so on a grey one it disappears — measured at 1.27
                  // against `background.elevation3`, in both colour modes.
                  ...(index === 3
                    ? {
                        bgcolor: 'background.elevation3',
                        color: 'text.secondary',
                      }
                    : {}),
                }}
              >
                {initials}
              </Avatar>
            ))}
          </Stack>
        </Box>
      </Stack>

      <SectionCode>
        {`const { Avatar } = flowContext.ui;

<Avatar>JD</Avatar>                        // initials
<Avatar src={photoUrl} alt={name}>JD</Avatar>  // an image, initials as fallback

// The signed-in user. There is no avatar URL on user — the fields are
// displayName, domain, email, extension, scope, department, site — so the
// picture is a read against the platform, through YOUR api client, which
// means the platform can attribute and rate-limit it like any other call.
const { api, user } = useFlowContext();
const [photo, setPhoto] = useState(null);

useEffect(() => {
  if (!api || !user?.domain || !user?.extension) return;
  let cancelled = false;
  api.get(\`/domains/\${user.domain}/users/\${user.extension}/avatar\`)
     .then((r) => { if (!cancelled) setPhoto(r?.[0]?.['path-large'] ?? null); })
     .catch(() => { if (!cancelled) setPhoto(null); });   // 404 = no avatar set
  return () => { cancelled = true; };
}, [api, user?.domain, user?.extension]);

// src wins when the image loads; the child is what shows when it does not,
// so a user with no photo gets initials and never a broken-image icon.
<Avatar src={photo ?? undefined} alt={user.displayName}>
  {initialsOf(user.displayName)}
</Avatar>

// Size is width + height together, and the font has to come with them,
// or the initials stay 20px inside a 56px circle.
<Avatar sx={{ width: 56, height: 56, fontSize: 22 }}>JD</Avatar>

// Colour from a PALETTE PATH, never a hex — this follows a reseller's brand
// and the dark/light toggle for free.
<Avatar sx={{ bgcolor: 'primary.main' }}>AB</Avatar>

// Overriding bgcolor to a NEUTRAL? Set color too. The default text colour is
// chosen to sit on a saturated fill, so on grey it vanishes (1.27:1 here).
<Avatar sx={{ bgcolor: 'background.elevation3', color: 'text.secondary' }}>
  +4
</Avatar>`}
      </SectionCode>

      <Typography
        variant='caption'
        color='text.secondary'
        sx={{ mt: 2, display: 'block' }}
      >
        💡 Used in: user lists, profiles, contacts — call history, user
        management, the directory. Always give an avatar a name in text nearby
        or an <code>alt</code>: two initials on their own tell a screen reader
        nothing. And derive them the way the host does — an avatar your app
        draws for the signed-in user sits inches from the one Flow draws, and
        two abbreviations of the same name is a mismatch nobody reports and
        everybody sees.
      </Typography>
    </Paper>
  );
}
