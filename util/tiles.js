'use strict';
import $ from 'jquery';

function noop() {
}

const styles = `
<style>
.on-tabs-tiles {
    display: inline-flex;
    flex-wrap: wrap;
}
.on-tabs-tiles .cell {
    width: 125px;
    position: relative;
    border: 2px solid white;
    display: flex;
    flex-direction: column;
}

.on-tabs-tiles .cell.inactive {
    opacity: 0.5;
}

.on-tabs-tiles .cell div {
    text-align: center;
}

.on-tabs-tiles .content {
    width: 120px;
    height: 120px;
    display: inline-flex;
    font-size:0.8em;
}
.on-tabs-tiles .hide {
    background-color: rgba(255,255,255,0.6);
    position: absolute;
    width: 120px;
    height: 120px;
    top:0;
    left:0;
    z-index:100;
}
.on-tabs-tiles .fa, .ci-icon {
    font-size: 5em;
    margin: auto;
}



.on-tabs-tiles .cell .main {
    font-size: 4.5em;
}

.on-tabs-tiles .cell .icon {
    margin: 17px;
}

.on-tabs-tiles .cell .title {
    font-weight: bold;
        margin: 15px;
}

.on-tabs-tiles .cell .header {
    font-size: 1.4em;
    font-weight: bold;
    z-index: 100;
    padding: 2px;
    margin-top: 4px;
}
.on-tabs-tiles .bottomRight {
    position:absolute;
    bottom: 5px;
    right: 8px;
    font-weight: bold;
    font-size: 1.4em;
}
.on-tabs-tiles .footer {
    font-size: 10px;
    overflow: hidden;
    padding: 2px;
    margin-bottom: 4px;
    flex: 1;
}

.on-tabs-tiles .ribbon-wrapper {
  width: 75px;
  height: 75px;
  overflow: hidden;
  position: absolute;
  top: 0px;
  right: 0px;
}
 
.on-tabs-tiles .ribbon {
  font: bold 1em Sans-Serif;
  color: white;
  text-align: center;
  transform:rotate(45deg);
  position: relative;
  padding: 3px 0px 0px 0px;
  left: 0px;
  top: 10px;
  width: 120px;
  background-color: rgba(255,0,0,0.9);
  z-index:10;
  
}
.on-tabs-tiles .ribbon.beta {
    background-color: rgba(0,0,255,0.9);
}
</style>
`;

const defaultOptions = {
    tiles: [],
    onTileClick: noop,
    ribbon: () => '',
    isLink: () => true,
    isActive: () => true,
    shouldRender: () => true,
    backgroundColor: tile => tile.backgroundColor,
    color: tile => tile.color,
    header: tile => tile.header,
    footer: tile => tile.footer,
    title: tile => tile.title,
    icon: tile => tile.icon
};

module.exports = function (div, options) {
    let lineCount = 0;
    options = Object.assign({}, defaultOptions, options);
    const {tiles} = options;
    const $div = $('#' + div);
    $div.empty();
    $div.append(styles);
    const $main = $(`<div>`);
    $div.append($main);
    if (!tiles)  return $div.append('No tiles');
    $main.addClass('on-tabs-tiles');
    $main.append(tiles.map(getTile));

    $main.on('click', function (event) {
        let $el;
        if ($(event.target).hasClass('cell')) {
            $el = $(event.target);
        } else {
            $el = $(event.target).parents('.cell').first();
        }
        let idx = $el.attr('data-idx');
        const tile = tiles[idx];
        if (tile && options.isActive(tile)) {
            options.onTileClick(event, tile, $el);
        }
    });


    function getTile(tile, idx) {
        tile.line = lineCount;
        if (Object.keys(tile).length === 1) {
            lineCount++;
            return '<div style="width: 100%"></div>';
        }
        if (!options.shouldRender(tile)) return '';
        const ribbon = options.ribbon(tile);
        const active = options.isActive(tile);
        const header = options.header(tile);
        const footer = options.footer(tile);
        const title = options.title(tile);
        const icon = options.icon(tile);

        let iconType = /(fa|ci-icon)-/.exec(icon);
        if (iconType) iconType = iconType[1];
        const $el = $(`
                <div class="cell ${active ? 'active' : 'inactive'}">
                    <div class='header'>${header || ''}</div>
                    ${icon ? `<div class="${iconType} ${icon} icon main"></div>` : `<div class="title main">${title || ''}</div>`}
                    <div class="footer">${footer || ''}</div>
                    
                    ${ribbon ? `<div class="ribbon-wrapper"><div class="ribbon beta">${ribbon}</div></div>` : ''}
                </div>
        `);

        $el.css({
            color: options.color(tile),
            backgroundColor: options.backgroundColor(tile),
            cursor: active && options.isLink(tile) ? 'pointer' : 'inherit',
        });

        $el.attr({
            'data-idx': idx
        });
        return $el;
    }
};
