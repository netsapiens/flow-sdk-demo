/**
 * Component Showcase — the visual reference for everything the host hands over
 * on `flowContext.ui`, and the page a partner developer is pointed at first.
 *
 * Each component has its own self-contained section under `showcase/sections/`
 * (live demo + copy-paste snippet + a note on where the host itself uses it);
 * this file is only the running order. The sections are grouped rather than
 * listed flat, because the page is long enough that a reader needs to know
 * whether they are still in "things you type into" or have reached "things that
 * draw data" — and because the groups are the shape of the kit itself.
 *
 * Every section renders nothing when its components are missing, so an older
 * host that predates a component simply shows a shorter page instead of a
 * broken one. That is the same guard partner code should use, demonstrated at
 * page scale.
 *
 * The header's Hide code action collapses every snippet at once. Roughly half
 * this page by height is source, which is what a developer came for and pure
 * noise to anyone scanning for a control — so the page is really two documents
 * and the toggle picks which one you are reading. It is also the shortest
 * honest demonstration of a `PageAction` descriptor: a label, an icon and an
 * onClick, rendered by the host in the same style as every other page's header
 * button.
 *
 * Localization follows one rule across the page and its sections: a visible
 * label goes through `t?.(KEY) ?? 'English'` wherever the host already has a
 * key for it — Apps in the breadcrumb, Templates below, and the labels inside
 * the live demos (Save, Cancel, Enabled, Overview, Status…). Everything else
 * stays English on purpose: the page title, component names, the descriptive
 * prose and every code snippet. An app ships its own strings for its own copy;
 * `t()` is for the words the platform already translates, and borrowing a
 * near-miss key for a heading would put the platform's meaning on our words.
 * Every key used here was checked against the host's en-US strings — a key the
 * host does not have renders as the key itself, not as the fallback.
 */
import { useState } from 'react';
import { useFlowContext, useLocale } from '@netsapiens/flow-sdk';

import { SHOWCASE_TEXT } from '../content/i18n/showcase';
import { useAppText } from '../i18n/useAppText';
import { type ZoneMarkerProps } from '../integration/withZoneTestId';
import {
  ActivityListSection,
  AlertSection,
  AvatarSection,
  ButtonsSection,
  CardSection,
  CarouselSection,
  ChartSection,
  CheckboxSection,
  ChipSection,
  DataGridSection,
  GroupHeading,
  IconButtonSection,
  IntroSection,
  LayoutSection,
  ListSection,
  RadioGroupSection,
  RadioSection,
  SearchFieldSection,
  SelectSection,
  SidePanelSection,
  StatBlockSection,
  SwitchSection,
  TableSection,
  TabsSection,
  TemplatesSection,
  TextFieldSection,
  ToggleButtonGroupSection,
  TooltipSection,
  TypographySection,
} from './showcase/sections';
import { ShowCodeContext } from './showcase/ShowCode';

export default function ComponentShowcasePage({ ...marker }: ZoneMarkerProps) {
  const { ui } = useFlowContext();
  // Flow's own words through t(); the app's own copy from its dictionaries.
  const { t } = useLocale();
  const text = useAppText(SHOWCASE_TEXT);
  const { PageTemplate } = ui?.templates || {};
  const { Stack } = ui || {};
  const [showCode, setShowCode] = useState(true);

  if (!PageTemplate || !Stack) {
    return (
      <div {...marker} style={{ padding: 24 }}>
        UI components not available
      </div>
    );
  }

  return (
    <PageTemplate
      {...marker}
      title={text.pageTitle}
      subtitle={text.pageSubtitle}
      breadcrumbs={[
        { label: t?.('APPS') ?? 'Apps', url: '/apps' },
        { label: text.pageTitle },
      ]}
      // A descriptor rather than JSX: the host then draws it in the house
      // style, which is the whole argument this page is making.
      actions={[
        {
          label: showCode ? text.hideCode : text.showCode,
          icon: showCode ? 'mdi:code-tags-check' : 'mdi:code-tags',
          variant: 'secondary',
          onClick: () => setShowCode((on) => !on),
          tooltip: showCode ? text.hideCodeTooltip : text.showCodeTooltip,
          'data-testid': 'sdk-demo-showcase-code-toggle',
        },
      ]}
    >
      <ShowCodeContext.Provider value={showCode}>
        <Stack spacing={3}>
          <IntroSection />

          <GroupHeading {...text.groups.foundations} />
          <TypographySection />
          <LayoutSection />
          <CardSection />

          <GroupHeading {...text.groups.inputs} />
          <ButtonsSection />
          <IconButtonSection />
          <TextFieldSection />
          <SearchFieldSection />
          <SelectSection />
          <CheckboxSection />
          <RadioSection />
          <RadioGroupSection />
          <SwitchSection />
          <ToggleButtonGroupSection />

          <GroupHeading {...text.groups.feedback} />
          <AlertSection />
          <ChipSection />
          <AvatarSection />
          <TooltipSection />
          <TabsSection />

          <GroupHeading {...text.groups.data} />
          <ListSection />
          <TableSection />
          <ChartSection />
          <StatBlockSection />
          <ActivityListSection />

          <GroupHeading
            title={t?.('TEMPLATES') ?? 'Templates'}
            blurb={text.groups.templates.blurb}
          />
          <TemplatesSection />
          <DataGridSection />
          <CarouselSection />
          <SidePanelSection />
        </Stack>
      </ShowCodeContext.Provider>
    </PageTemplate>
  );
}
