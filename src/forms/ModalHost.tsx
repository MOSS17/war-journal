import { useOverlay } from '../components/overlay';
import { CharacterForm } from './CharacterForm';
import { ProgressForm } from './ProgressForm';
import { PlanForm } from './PlanForm';
import { JournalForm } from './JournalForm';
import { LibraryForm } from './LibraryForm';
import { InstanceProgressForm } from './InstanceProgressForm';
import { ConfirmModal, DataModal, EventForm, InstanceForm, QuickAdd } from './misc';

export function ModalHost() {
  const { modal: m, modalKey: key, close } = useOverlay();
  if (!m) return null;
  switch (m.kind) {
    case 'quick':
      return <QuickAdd key={key} onClose={close} />;
    case 'character':
      return <CharacterForm key={key} id={m.id} onClose={close} />;
    case 'progress':
      return <ProgressForm key={key} characterId={m.characterId} onClose={close} />;
    case 'plan':
      return <PlanForm key={key} id={m.id} preset={m.preset} onClose={close} />;
    case 'journal':
      return <JournalForm key={key} id={m.id} preset={m.preset} onClose={close} />;
    case 'library':
      return <LibraryForm key={key} id={m.id} preset={m.preset} onClose={close} />;
    case 'instanceProgress':
      return <InstanceProgressForm key={key} instanceId={m.instanceId} characterId={m.characterId} onClose={close} />;
    case 'instance':
      return <InstanceForm key={key} id={m.id} onClose={close} />;
    case 'event':
      return <EventForm key={key} id={m.id} onClose={close} />;
    case 'data':
      return <DataModal key={key} onClose={close} />;
    case 'confirm':
      return <ConfirmModal key={key} {...m} onClose={close} />;
  }
}
