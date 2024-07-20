export const GAME_STATES = {
    START: 0,
    LOOP: 1,
    END: 2
}
let gameState = GAME_STATES.START;

const game = (manifold, window) => {
    const ans = {};
    ans.neighbors = [];
    ans.selectedIndex = 0;
    ans.selectedObjects = [];
    ans.vertexScore = 1;
    ans.timeInSeconds = 1;
    ans.totalVertices = undefined;
    return ans;
}
export default game;