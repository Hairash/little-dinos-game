import Models from '@/game/models'

/**
 * Structured right-click hint for a building type. Shared by CellContextHelp
 * (map) and GameMenuOverlay (statistics table).
 */
export function getBuildingHintContent(
  buildingType,
  {
    unitModifier = 3,
    baseModifier = 3,
    fogOfWarRadius = 3,
    playerColor = null,
    warning = false,
  } = {}
) {
  const towerTitleStyle = playerColor ? { color: playerColor } : null

  switch (buildingType) {
    case Models.BuildingTypes.BASE:
      return {
        title: 'Tower',
        titleStyle: towerTitleStyle,
        description: 'Produce 1 unit every turn',
        warning,
      }
    case Models.BuildingTypes.HABITATION:
      return {
        title: 'Habitation',
        titleStyle: null,
        description: `Units limit +${unitModifier}`,
        warning: false,
      }
    case Models.BuildingTypes.TEMPLE:
      return {
        title: 'Temple',
        titleStyle: null,
        description: 'Speed for generated units +1',
        warning: false,
      }
    case Models.BuildingTypes.WELL:
      return {
        title: 'Well',
        titleStyle: null,
        description: 'Speed for current unit +1',
        warning: false,
      }
    case Models.BuildingTypes.STORAGE:
      return {
        title: 'Storage',
        titleStyle: null,
        description: `Towers limit +${baseModifier}`,
        warning: false,
      }
    case Models.BuildingTypes.OBELISK:
      return {
        title: 'Obelisk',
        titleStyle: null,
        description: `Show any part of the map ${fogOfWarRadius}x${fogOfWarRadius}`,
        warning: false,
      }
    default:
      return null
  }
}
