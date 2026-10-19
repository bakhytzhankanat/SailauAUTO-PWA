export const DOOR_SIDE_LABELS = {
  left: 'Сол жақ есік',
  right: 'Оң жақ есік',
  both: 'Екі есік',
};

/** Toggle one side ('left' | 'right') of a door_side value; both sides selected → 'both'. */
export function toggleDoorSide(current, side) {
  const left = current === 'left' || current === 'both';
  const right = current === 'right' || current === 'both';
  const nextLeft = side === 'left' ? !left : left;
  const nextRight = side === 'right' ? !right : right;
  if (nextLeft && nextRight) return 'both';
  if (nextLeft) return 'left';
  if (nextRight) return 'right';
  return null;
}
