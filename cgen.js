/**
 *
 * Copyright (C) 2015 Ken L.
 * Licensed under the GPL Version 3 license.
 * http://www.gnu.org/licenses/gpl.html
 *
 * Contributors:
 * Andy W.
 * Shu Zong C.
 * Carlos R. L. Rodrigues
 *
 *
 * This script is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This script is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *
 * This script is designed to parse stat blocks from the pathfinder PRD which are
 * formatted in a very particular way. Know that there will be edge cases which
 * are not handled due to the large varity of conditions.
 *
 * It is charactersheet agnostic as it simply creates ability fields and marcos for
 * the provided statblock. It is also light-weight simply (if enabled) linking or
 * reminding a GM of information or abilities a creature has.
 *
 * If copying stat blocks from PDFs or other Paizo or Paizo compatible sources,
 * ensure that they fit the PRD specified layout (1 line per ability etc), when
 * in doubt, copy it into a text editor and confirm what you copied fits the PRD
 * format.
 *
 * If all else fails, it's probably an edge case I didn't consider; or the stat
 * block is malformed. Feel free to patch up the holes and commit to the git-hub to
 * make the script better for everyone.
 *
 * https://github.com/Roll20KenL/Roll20_API_Scripts/blob/master/cgen.js
 *
 */

var CreatureGenPF = (function() {
  "use strict";
  var version = 1.33,
    author = "Ken L.",
    contributers = "Andy W., Shu Zong C., Carlos R. L. Rodrigues",
    debugLvl = 1,
    locked = false,
    unitPixels = 70,
    workStart = 0,
    workDelay = 250,
    workList = [],
    dmesg,
    warn,
    creName,
    character;

  var termEnum = Object.freeze({
    GENERAL: 1,
    MONABILITY: 2,
    SPELL: 3,
    FEAT: 4,
    SQ: 5,
    SA: 6,
    SKILL: 7
  });

  var bonusEnum = Object.freeze({
    SCALAR: 1,
    SIGN: 2
  });

  var urlCondEnum = Object.freeze({
    FULL: "FULL",
    LABEL: "LABEL"
  });

  var atkEnum = Object.freeze({
    TITLE: "TITLE",
    ATTACK: "ATTACK",
    DAMAGE: "DAMAGE"
  });

  /**
   * Various fields that can be changed for customization
   *
   */
  var fields = {
    defaultName: "Creature",
    charDataPrefix: "CGen_",
    publicName: "@{CGen_name}",
    publicEm: "/emas ",
    publicAtkEm: "/as Attack ",
    publicDmgEm: "/as Damage ",
    publicAnn: "/desc ",
    privWhis: "/w GM ",
    menuWhis: "/w GM ",
		resultWhis: "/w GM ",
		
		// TODO: look at updating these URLs if need be
    urlTermGeneral:
      '<a href="http://www.google.com/cse?cx=006680642033474972217%3A6zo0hx_wle8&q=<<FULL>>"><span style="color: #FF0000; font-weight: bold;"><<LABEL>></span></a>',
    //urlTermGeneral: '<a href="http://www.d20pfsrd.com/system/app/pages/search?scope=search-site&q=<<FULL>>"><span style="color: #FF0000; font-weight: bold;"><<LABEL>></span></a>',
    urlTermMonAbility:
      '<a href="http://paizo.com/pathfinderRPG/prd/additionalMonsters/universalMonsterRules.html#<<FULL>>"><span style="color: #2F2F2F; font-weight: bold;"><<FULL>></span></a>',
    urlTermSpell:
      '<a href="http://www.d20pfsrd.com/magic/all-spells/<<0>>/<<FULL>>"><span style="color: #2E39FF; font-weight: bold;"><<LABEL>></span></a>',
    urlTermFeat:
      '<a href="http://www.google.com/cse?cx=006680642033474972217%3A6zo0hx_wle8&q=<<FULL>>"><span style="color: #29220A; font-weight: bold;"><<FULL>></span></a>',
    urlTermSQ: "", // unused
    urlTermSA: "", // unused
    summoner: undefined,
    shortAtkRiders: false // unused
  };

  /**
   * div border styles, customize it for your game!
   *
   * <span [[format text injected here]]> penguins </span>
   * <img src="[[image link]]">"
   */
  var design = {
    feedbackName: "Ken L.",
    feedbackImg:
      "https://s3.amazonaws.com/files.d20.io/images/3466065/uiXt3Zh5EoHDkXmhGUumYQ/thumb.jpg?1395313520",
    errorImg:
      "https://s3.amazonaws.com/files.d20.io/images/7545187/fjEEs0Jvjz1uy3mGN5A_3Q/thumb.png?1423165317",
    warningImg:
      "https://s3.amazonaws.com/files.d20.io/images/7926480/NaBmVmKe94rdzXwVnLq0-w/thumb.png?1424965188",
    successImg:
      "https://s3.amazonaws.com/files.d20.io/images/7545189/5BR2W-XkmeVyXNsk-C8Z6g/thumb.png?1423165325",

    skillTitleFmt:
      'style="color: #000000; font-weight: bold; font-size: 125%;"',
    skillLabelFmt:
      'style="color: #44824C; font-weight: bold; font-size: 110%;"',
    skillTopImg:
      "https://s3.amazonaws.com/files.d20.io/images/7816000/-QKJOJF6UFmDAEypDGeXcw/thumb.png?1424460624",
    skillMidImg:
      "https://s3.amazonaws.com/files.d20.io/images/7816002/nKEWcTQ2VjcRJqrfiMHg_w/thumb.png?1424460630",
    skillBotImg:
      "https://s3.amazonaws.com/files.d20.io/images/7816003/lcNufMB1JeLmdDVPJ0KFdQ/thumb.png?1424460634",

    spellBookTitleFmt:
      'style="color: #000000; font-weight: bold; font-size: 125%;"',
    spellBookLabelFmt:
      'style="color: #44824C; font-weight: bold; font-size: 110%;"',
    spellBookTopImg:
      "https://s3.amazonaws.com/files.d20.io/images/7834797/n4P8Ys6gHoKmVlBTRYoi9Q/thumb.png?1424540093",
    spellBookMidImg:
      "https://s3.amazonaws.com/files.d20.io/images/7834799/LOJaPHkZcUDyekpMnm0-Cg/thumb.png?1424540096",
    spellBookMidOvr:
      "https://s3.amazonaws.com/files.d20.io/images/7836432/fi7Bw5cRaMfq0fjBZZ7ggg/thumb.png?1424544220",
    spellBookBotImg:
      "https://s3.amazonaws.com/files.d20.io/images/7834800/ORBbrVuMO7Ns2UoPRmvfRg/thumb.png?1424540099",

    spellTitleFmt:
      'style="color: #000000; font-weight: bold; font-size: 125%;"',
    spellLabelFmt:
      'style="color: #44824C; font-weight: bold; font-size: 110%;"',
    spellTopImg:
      "https://s3.amazonaws.com/files.d20.io/images/7382439/dJ-jaPdm6kEtl9lE__ve-g/thumb.png?1422405849",
    spellMidImg:
      "https://s3.amazonaws.com/files.d20.io/images/7382437/FYBtfPgkj4b3Q_hLkUk5Gg/thumb.png?1422405847",
    spellBotImg:
      "https://s3.amazonaws.com/files.d20.io/images/7382435/DXm7UUdLKNnF6ktFfVojWA/thumb.png?1422405843",

    specialTitleFmt:
      'style="color: #000000; font-weight: bold; font-size: 125%;"',
    specialLabelFmt:
      'style="color: #44824C; font-weight: bold; font-size: 110%;"',
    specialTopImg:
      "https://s3.amazonaws.com/files.d20.io/images/7816913/PsSBFlCv3IlPzGP0usiVBw/thumb.png?1424464282",
    specialMidImg:
      "https://s3.amazonaws.com/files.d20.io/images/7816781/0g1qpdJ80DTvpSHqQ2-7oA/thumb.png?1424463781",
    specialBotImg:
      "https://s3.amazonaws.com/files.d20.io/images/7816784/aZ1OFXDsO2BUM5G9oiXpgw/thumb.png?1424463791",

    atkTitleFmt: 'style="color: #000000; font-weight: bold; font-size: 125%;"',
    atkLabelFmt: 'style="color: #44824C; font-weight: bold; font-size: 110%;"',
    atkTopImg:
      "https://s3.amazonaws.com/files.d20.io/images/7816913/PsSBFlCv3IlPzGP0usiVBw/thumb.png?1424464282",
    atkMidImg:
      "https://s3.amazonaws.com/files.d20.io/images/7816781/0g1qpdJ80DTvpSHqQ2-7oA/thumb.png?1424463781",
    atkBotImg:
      "https://s3.amazonaws.com/files.d20.io/images/7816784/aZ1OFXDsO2BUM5G9oiXpgw/thumb.png?1424463791",

    atkMenuTitleFmt:
      'style="color: #000000; font-weight: bold; font-size: 125%;"',
    atkMenuLabelFmt:
      'style="color: #44824C; font-weight: bold; font-size: 110%;"',
    atkMenuTopImg:
      "https://s3.amazonaws.com/files.d20.io/images/7816912/WWQxo9xFhc-vETYw79f0wA/thumb.png?1424464275",
    atkMenuMidImg:
      "https://s3.amazonaws.com/files.d20.io/images/7816781/0g1qpdJ80DTvpSHqQ2-7oA/thumb.png?1424463781",
    atkMenuBotImg:
      "https://s3.amazonaws.com/files.d20.io/images/7816783/m3UhKz4plb_0TB1kUOAI1Q/thumb.png?1424463787",

    genTitleFmt: 'style="color: #000000; font-weight: bold; font-size: 125%;"',
    genLabelFmt: 'style="color: #44824C; font-weight: bold; font-size: 110%;"',
    genTopImg:
      "https://s3.amazonaws.com/files.d20.io/images/7816014/jpO1FF9pA7Ipi__sFQAAMw/thumb.png?1424460680",
    genMidImg:
      "https://s3.amazonaws.com/files.d20.io/images/7816016/0XT65Rctt1imgamKQUO6sg/thumb.png?1424460684",
    genBotImg:
      "https://s3.amazonaws.com/files.d20.io/images/7816023/T6uTWEX4aMDL-78lhSLanw/thumb.png?1424460752"
  };

  var atkTemplate =
    '<div class="img" style="column-gap: 0; line-height: 0; position: relative; text-align: center;">' +
    '<img src="' +
    "https://s3.amazonaws.com/files.d20.io/images/7926600/1gnY_LsAt4UHnkJmI3PAlA/thumb.png?1424966062" +
    '">' +
    "</div>" +
    '<div style="background-image: url(' +
    "https://s3.amazonaws.com/files.d20.io/images/7926601/79qaHPngD_d9MFVlrNTB8w/thumb.png?1424966067" +
    '); background-repeat: repeat-y; background-position: center center; text-align: center; padding-left: 7px; padding-right: 7px;">' +
    "<div>" +
    '<div style="colspan: 2; color: #FFFFFF; font-style: italic; text-shadow: -1px -1px 1px #000, 1px -1px 1px #000, -1px 1px 1px #000, 1px 1px 1px #000; padding-top: 4px; padding-bottom: 4px; margin-left: auto; margin-right: auto; width: 160px">' +
    '<span style="font-weight: bold;"><<TITLE>></span>' +
    "</div>" +
    '<div style="color: #FFFFFF; text-shadow: -1px -1px 1px #000, 1px -1px 1px #000, -1px 1px 1px #000, 1px 1px 1px #000; padding-top: 4px; padding-bottom: 4px; display: block; font-weight: bold;">' +
    '<table style="width: 140px; text-align: left; margin-left: auto; margin-right: auto; border-spacing: 5;">' +
    "<tr>" +
    "<td>" +
    "Attack:" +
    "</td>" +
    "<td>" +
    "<<ATTACK>>" +
    "</td>" +
    "</tr>" +
    "<tr>" +
    "<td>" +
    "Damage:" +
    "</td>" +
    "<td>" +
    "<<DAMAGE>>" +
    "</td>" +
    "</tr>" +
    "</table>" +
    " </div>" +
    "</div>" +
    "</div>" +
    '<div class="img" style="column-gap: 0; line-height: 0; position: relative; text-align: center;">' +
    '<img src="' +
    "https://s3.amazonaws.com/files.d20.io/images/7926602/lMjFWWNyFpUlbk80HqkeOQ/thumb.png?1424966073" +
    '">' +
    "</div>";

  var menuTemplate = {
    boundryImg: _.template(
      '<div class="img" style="column-gap: 0; line-height: 0; position: relative; text-align: center;">' +
        '<img src="<%= imgLink %>">' +
        "</div>"
    ),
    titleFmt: _.template(
      "<div>" + "<span <%= style %> >" + "<%= title %>" + "</span>" + "</div>"
    ),
    midDiv: _.template(
      '<div style="background-image: url(' +
        "<%= imgLink %>" +
        '); background-repeat: repeat-y; background-position: center center; text-align: center;">'
    ),
    /*
		midDivOverlay: _.template('<div style="background: url(<%= imgLink %>) center center no-repeat; pointer-events: none;'
					+ 'position: absolute; left: 0; top: 0; width: 200px; height: 200px;'
					+ ' text-align: center;">'),
		*/
    midDivOverlay: _.template(
      '<div style="background: ' +
        "url(<%= imgLinkOverlay %>) no-repeat center center," +
        "url(<%= imgLink %>) repeat-y center center;" +
        ' text-align: center; min-height: 150px;">' +
        '<table style="width: 100%; height: 100%; text-align: center; vertical-align: middle; min-height: 150px;">' +
        '<tr><td style="text-align: center; vertical-align: middle;">'
    ),
    midButton: _.template(
      '<div style="text-align: center;">' +
        "<%= '<span '+ (riders ? ('class=\"showtip tipsy\" title=\"' + riders + '\"') : '') + ' style=\"font-weight: bold;\">' %>" +
        "<%= '<a href=\"!' + '&'+'#37' + ';{'+creName+'|'+abName+'}\">'+btnName+'</a>' %>" +
        "</span>" +
        "</div>"
    ),
    midButtonFree: _.template(
      "<%= '<span '+ (riders ? ('class=\"showtip tipsy\" title=\"' + riders + '\"') : '') + ' style=\"font-weight: bold;\">' %>" +
        "<%= '<a href=\"!' + '&'+'#37' + ';{'+creName+'|'+abName+'}\">'+btnName+'</a>' %>" +
        "</span>"
    ),
    midLink: _.template(
      '<div style="text-align: center;">' +
        "<%= '<span '+ (riders ? ('class=\"showtip tipsy\" title=\"' + riders + '\"') : '') + ' style=\"font-weight: bold;\">' %>" +
        "<%= link %>" +
        "</span>" +
        "</div>"
    ),
    midLinkFree: _.template(
      "<%= '<span '+ (riders ? ('class=\"showtip tipsy\" title=\"' + riders + '\"') : '') + ' style=\"font-weight: bold;\">'" +
        "+ link +" +
        "'</span>' %>"
    ),
    midLinkCaption: _.template(
      '<div style="text-align: center;">' +
        "<%= link %>" +
        "<%= (riders ? ('<span style=\"color: #2B2B2B; font-weight: lighter; font-style: italic; font-size: 70%;\">' + riders + '</span>'):\"\") %>" +
        "</div>"
    ),
    midLeadText: _.template(
      "<%= '<span '+ (riders ? ('class=\"showtip tipsy\" title=\"' + riders + '\" style=\"font-weight: bold; color:#FFFFFF; text-shadow: -1px -1px 1px #000, 1px -1px 1px #000, -1px 1px 1px #000, 1px 1px 1px #000;\">') : ' style=\"font-weight: bold; color:#000000;\">') %>" +
        "<%= label %>" +
        '</span> <span style="color: #000000;"><%= text %></span>'
    ),
    midText: _.template(
      "<%= '<span '+ (riders ? ('style=\"font-weight: bold; color:#FFFFFF; text-shadow: -1px -1px 1px #000, 1px -1px 1px #000, -1px 1px 1px #000, 1px 1px 1px #000;\" class=\"showtip tipsy\" title=\"' + riders + '\"') : ' style=\"color: #000000;\"') + '>' %>" +
        "<%= text %>" +
        "</span>"
    )
  };

  /**
   * selectDesignTemplate - searches CGTmp.designTmp for template named name.
   * sets design to that template and
   * sets state.cgen_design to the template name
   * @param {string} name lowercase name of template to find
   * @param {boolean} quiet controls if output messages are displayed
   * @returns {boolean} true if template is found
   */
  var selectDesignTemplate = function(name, quiet) {
    var flag;
    if (typeof CGTmp !== "undefined") {
      try {
        for (var tmp in CGTmp.designTmp) {
          if (tmp.toLowerCase() === name) {
            design = CGTmp.designTmp[tmp];
            if (!quiet) {
              sendFeedback(
                '<span style="color: #653200; font-weight: bold;">Design template:</span> <b style="color: #009C26;">' +
                  tmp +
                  "</b> has been configured for future tokens generated.</span>"
              );
            }
            state.cgen_design = tmp;
            flag = true;
            break;
          }
        }
        if (!flag) {
          sendFeedback(
            '<span style="color: #990004;">Design template: \'' +
              name +
              "' does not exist</span>"
          );
        }
      } catch (e) {
        log(e);
      }
    } else {
      sendFeedback(
        '<span style="color: #990004;">No CreatureGen templates found, ' +
          "did you load the additional templates script?</span>"
      );
    }
    return flag;
  };

  /**
   * selectAttackTemplate - searches CGTmp.attackTmp for template named name.
   * sets fields.tmpAtk to that template and
   * sets state.cgen_attack to the template name
   * @param {string} name lowercase name of template to find
   * @param {boolean} quiet controls if output messages are displayed
   * @returns {boolean} true if template is found
   */
  var selectAttackTemplate = function(name, quiet) {
    var flag;
    if (typeof CGTmp !== "undefined") {
      try {
        for (var tmp in CGTmp.attackTmp) {
          if (tmp.toLowerCase() === name) {
            fields.tmpAtk = CGTmp.attackTmp[tmp];
            if (!quiet) {
              sendFeedback(
                '<span style="color: ##155391; font-weight: bold;">Attack template:</span> <b style="color: #009C26;">' +
                  tmp +
                  "</b> has been configured for future tokens generated.</span>"
              );
            }
            state.cgen_attack = tmp;
            flag = true;
            break;
          }
        }
        if (!flag) {
          sendFeedback(
            '<span style="color: #990004;">Attack template: \'' +
              name +
              "' does not exist</span>"
          );
        }
      } catch (e) {
        log(e);
      }
    } else {
      sendFeedback(
        '<span style="color: #990004;">No CreatureGen templates found, ' +
          "did you load the additional templates script?</span>"
      );
    }
    return flag;
  };

  /**
   * fixNewObject - Object fix to resolve firebase errors
   * substitutes (<anything>/){4} with a single '/'
   * @author Shu Zong C.
   * @param {any} obj the object to fix
   * @returns {any} modified obj
   */
  var fixNewObject = function(obj) {
    var p = obj.changed._fbpath;
    if (p !== undefined) {
      var new_p = p.replace(/([^\/]*\/){4}/, "/");
      obj.fbpath = new_p;
    }
    return obj;
  };

  /**
   * scan in information from token notes
   *
   * @contribuitor Andy W.
   * @param {any} token The selected token
   */
  var scan = function(token) {
    var charSheet;
    var data;
    var rawData;
    var dispData = "";

    if (!token) {
      throw "No Token selected";
    }
    rawData = token.get("gmnotes");
    creLog("RAW: " + rawData);
    if (!rawData) {
      throw "no token notes";
    }
    data = rawData.split(/%3Cbr%3E|\\n|<br>/);

    //clean out all other data except text
    for (var i = data.length; i >= 0; i--) {
      if (data[i]) {
        data[i] = cleanString(data[i]).trim();
        if (!data[i].match(/[^\s]/)) {
          data.splice(i, 1);
        }
      }
    }

    // Essential parameters for object creation (mainly the name)
    parseEssential(data);

    // if character name already exists, close out.
    if (
      findObjs({
        _type: "character",
        name: creName
      }).length > 0
    ) {
      creLogWarning("Character '" + creName + "' already exists.");
      throw "Character '" + creName + "' already exists.";
    }

    dispData = formatDisplay(data);

    charSheet = createObj("character", {
      avatar: token.get("imgsrc"),
      name: creName,
      gmnotes: "",
      archived: false,
      inplayerjournals: "",
      controlledby: ""
    });

    charSheet = fixNewObject(charSheet);
    if (!charSheet) {
      throw "ERROR: could not create character sheet";
    }
    if (fields.summoner) {
      charSheet.set("bio", '<br clear="both">' + dispData);
    }

    token.set("represents", charSheet.get("_id"));
    charSheet.set("gmnotes", dispData);
    character = charSheet;

    // warn on image source
    if (charSheet.get("avatar") === "") {
      creLogWarning("Unable to set avatar to character journal, only images you've " +
        "uploaded yourself are viable during creation. Auto-population " +
        "<i>(drag-drop population)</i> will not be possible without an avatar image." +
        " You can still upload an avatar manually, or drag an image into the avatar field" +
        " from the image-search.");
    }

    // parse up our data set.
    var specials;

    try {
      parseCore(data);
      specials = parseSpecials(data);
      parseAttacks(data, specials);
      parseSpells(data);
      parseExtra(data, specials);
      prepToken(token, charSheet);
    } catch (e) {
      log("ERROR when parsing");
      throw e;
    }
  };

  /**
   * formatDisplay - formats the display of the stat-block
   * @param {*} datum - the cleaned lines from the token's gm notes
   * @returns {string} - the formatted lines for everything in the cleaned lines of the gm notes
   */
  var formatDisplay = function(datum) {
    if (!datum) {
      return undefined;
    }
    var content = "";

    _.each(datum, function(e, i, l) {
      creLog("(" + i + ") " + e, 1);
      if (
        e.match("DEFENSE") ||
        e.match("OFFENSE") ||
        e.match("TACTICS") ||
        e.match("BASE STATISTICS") ||
        e.match("STATISTICS") ||
        e.match("ECOLOGY") ||
        e.match("SPECIAL ABILITIES")
      ) {
        content +=
          '<div style="font-size: 112%; border-bottom: 1px solid black; border-top: 1px solid black; margin-top: 8px;">' +
          e +
          "</b></div>";
      } else if (e.match(/\(Ex\)|\(Su\)|\(Sp\)/i)) {
        content += "<div>" + e + "</div>";
      } else {
        content += e + "<br>";
      }
    });
    return content;
  };

  /**
   * prepToken - preps the token - Asynchronous
   * @param {token} token - the token
   * @param {character} character - the character sheet
   */
  var prepToken = function(token, character) {
    if (!token || !character) {
      return;
    }
    var name, AC, hp, prep;
    var charId = character.get("_id");

    hp = getAttribute("hp", charId);

    AC = getAttribute("AC", charId);

    prep = getAttribute("CGEN", charId);

    name = character.get("name");

    // Fast vs cb delay
    if (token.get("gmnotes")) {
      if (hp && AC && name && prep && prep.get("current").match(/true/i)) {
        hp = hp.get("current");
        AC = AC.get("current");
        token.set("bar1_value", hp);
        token.set("bar1_max", hp);
        token.set("showplayers_bar1", true); // added display of HP
        token.set("bar3_value", AC);
        token.set("name", name);
        token.set("showname", true);
        token.set("light_hassight", true);
        resizeToken(token, character);
      }
    } else {
      character.get("gmnotes", function(notes) {
        if (
          hp &&
          AC &&
          name &&
          prep &&
          prep.get("current").match(/true/i) &&
          notes &&
          notes !== ""
        ) {
          hp = hp.get("current");
          AC = AC.get("current");
          token.set("bar1_value", hp);
          token.set("bar1_max", hp);
          token.set("showplayers_bar1", true); // added display of HP
          token.set("bar3_value", AC);
          token.set("name", name);
          token.set("showname", true);
          token.set("light_hassight", true);
          token.set(
            "gmnotes",
            notes.replace(/<div[^<>]*>/g, "").replace(/<\/div>/g, "<br>")
          );
          resizeToken(token, character);
        }
      });
    }
  };

  /**
   * resizeToken - resizes the token from the character's size sttribute
   * @param {token} token - the token to resize
   * @param {character} character - the character sheet to get the size parameter from
   */
  var resizeToken = function(token, character) {
    var charId = character.get("_id");
    var unitSize = 1;
    var pageScale = getObj("page", token.get("_pageid")).get(
      "snapping_increment"
    );
    var tsize = parseInt(unitPixels * (pageScale === 0 ? 1 : pageScale));
    var size = getAttribute("Size", charId);
    if (!size) {
      return;
    }

    switch (size.get("current")) {
      case "Fine": // is there any way to get smaller than 1?  I would guess there is!
      case "Diminutive":
      case "Tiny":
      case "Small":
      case "Medium":
        break;
      case "Large":
        unitSize = 2;
        break;
      case "Huge":
        unitSize = 3;
        break;
      case "Gargantuan":
        unitSize = 4;
        break;
      case "Colossal":
        unitSize = 6;
        break;
      default:
        creLog("resizeToken: Bad size '" + size + "' ");
    }

    token.set("width", tsize * unitSize);
    token.set("height", tsize * unitSize);
  };

  /**
   * parseEssential - gets the name from the cleaned gm notes field
   *@param {string[]} data - The cleaned data from the gm notes field of the token
   */
  var parseEssential = function(data) {
    /* names are tricky as we delimit on CR, last occurance of CR
		which has numbers after it TODO use a regex which is shorter*/
    var namefield = data[0];
    var delimiter_idx = namefield.lastIndexOf("CR");
    var fuzzyfield = namefield.substring(delimiter_idx, namefield.length);
    if (delimiter_idx <= 0 || !fuzzyfield.match(/\d+|—/g)) {
      delimiter_idx = namefield.length;
    }
    var name = namefield.substring(0, delimiter_idx);
    name = name.trim().toLowerCase();
    creName = fields.summoner
      ? fields.summoner.get("_displayname") + "'s " + name
      : name;
    fields.publicName = fields.summoner ? creName : fields.publicName;
  };

  /**
   * parseCore - parse things like character attributes, AC, HP, etc.
   *@param {string[]} data - The cleaned data from the gm notes field of the token
   */
  var parseCore = function(data) {
    if (!data) {
      return;
    }

    // set the character sheets ownership
    if (fields.summoner) {
      character.set("controlledby", fields.summoner.get("_id"));
      character.set("inplayerjournals", fields.summoner.get("_id"));
    }

    var charId = character.get("_id");
    var line = "";
    var lineStartFnd = 0;
    var lineEndFnd = data.length;
    var termChars = [";", ","];
    var rc = -1;
    var initVal;

    // core attribute fields
    var initAttr = "Init";
    var primeAttr = ["Str", "Dex", "Con", "Int", "Wis", "Cha"];
    var minorAttr = ["Base Atk", "CMB", "CMD"];
    var defAttr = ["AC", "touch", "flat-footed", "hp"];
    var saveAttr = ["Fort", "Ref", "Will"];

    //Flag that this token will be prepped, can be removed by the user
    addAttribute("CGEN", "true", "", charId);
    addAttribute("name", fields.defaultName, "", charId);
    // Init (TODO mythic Init)
    line = getLineByName(initAttr, data);
    initVal = getValueByName(initAttr, line, termChars);
    addAttribute(initAttr, initVal, initVal, charId);
    // prime attributes
    lineStartFnd = getLineNumberByName("STATISTICS", data);
    lineEndFnd = getLineNumberByName("SPECIAL ABILITIES", data);
    line = getLineByName("Str", data, lineStartFnd, lineEndFnd);
    addAttrList(data, line, primeAttr, lineStartFnd, termChars, charId);
    // minor attributes
    line = getLineByName("Base Atk", data, lineStartFnd, lineEndFnd);
    addAttrList(data, line, minorAttr, lineStartFnd, termChars, charId);
    // defense attributes
    lineStartFnd = getLineNumberByName("DEFENSE", data);
    lineEndFnd = getLineNumberByName("OFFENSE", data);
    line = getLineByName("AC", data, lineStartFnd, lineEndFnd);
    addAttrList(data, line, defAttr, lineStartFnd, termChars, charId);
    // save attributes
    line = getLineByName("Fort", data, lineStartFnd, lineEndFnd);
    addAttrList(data, line, saveAttr, lineStartFnd, termChars, charId);

    //format attributes:
    formatAttribute("hp", 0, charId);
    formatAttribute("AC", 0, charId);
    formatAttribute("touch", 0, charId);
    formatAttribute("flat-footed", 0, charId);

    // determine size
    var size = parseSize(data);
    creLog("parsecore: size: " + size, 1);
    addAttribute("Size", size, size, charId);

    var rider = "";

    // save riders
    if ((rc = line.indexOf(";")) !== -1) {
      rider = "(" + line.substring(rc + 1) + ")";
    } else {
      rider = "";
    }

    addAttributeRoll("INIT", initAttr, false, true, charId, "&{tracker}");
    addAttributeRoll("F", "Fort", false, true, charId, rider);
    addAttributeRoll("R", "Ref", false, true, charId, rider);
    addAttributeRoll("W", "Will", false, true, charId, rider);
  };

  /**
   * parseSize - Parse Size of the creature
   *@param {string[]} data - The cleaned data from the gm notes field of the token
   * @returns {string} the Pathfinder name of the size
   */
  var parseSize = function(data) {
    // TODO modify getLineByName and getLineNumberByName to allow regex
    // TODO this could be combined with resizeToken (like, passed into it!)

    var retval = "Medium";
    var lineEndFnd = getLineNumberByName("DEFENSE", data);
    var space = getLineByName(
      "Space",
      data,
      getLineNumberByName("OFFENSE", data),
      getLineNumberByName("STATISTICS", data)
    );
    creLog("parseSize: space is " + space);
    if (space) {
      space = getValueByName("Space", space, [";", ","]);
      space = getBonusNumber(space, bonusEnum.SCALAR);
      space = parseInt(space);
      if (isNaN(space)) {
        return;
      }
      space = space / 5;
      switch (space) {
        case 1:
          retval = "Medium";
          break;
        case 2:
          retval = "Large";
          break;
        case 3:
          retval = "Huge";
          break;
        case 4:
          retval = "Gargantuan";
          break;
        case 6:
          retval = "Colossal";
          break;
        default:
          retval = "Medium";
          break;
      }
    } else if (
      getLineByName("Fine", data, 0, lineEndFnd) ||
      getLineByName("fine", data, 0, lineEndFnd)
    ) {
      retval = "Fine";
    } else if (
      getLineByName("Diminutive", data, 0, lineEndFnd) ||
      getLineByName("diminutive", data, 0, lineEndFnd)
    ) {
      retval = "Diminutive";
    } else if (
      getLineByName("Tiny", data, 0, lineEndFnd) ||
      getLineByName("tiny", data, 0, lineEndFnd)
    ) {
      retval = "Tiny";
    } else if (
      getLineByName("Small", data, 0, lineEndFnd) ||
      getLineByName("small", data, 0, lineEndFnd)
    ) {
      retval = "Small";
    } else if (
      getLineByName("Medium", data, 0, lineEndFnd) ||
      getLineByName("Medium", data, 0, lineEndFnd)
    ) {
      retval = "Medium";
    } else if (
      getLineByName("Large", data, 0, lineEndFnd) ||
      getLineByName("Large", data, 0, lineEndFnd)
    ) {
      retval = "Large";
    } else if (
      getLineByName("Huge", data, 0, lineEndFnd) ||
      getLineByName("huge", data, 0, lineEndFnd)
    ) {
      retval = "Huge";
    } else if (
      getLineByName("Gargantuan", data, 0, lineEndFnd) ||
      getLineByName("gargantuan", data, 0, lineEndFnd)
    ) {
      retval = "Gargantuan";
    } else if (
      getLineByName("Colossal", data, 0, lineEndFnd) ||
      getLineByName("colossal", data, 0, lineEndFnd)
    ) {
      retval = "Colossal";
    }

    return retval;
  };

  /**
   * parse special attacks, if the statblock has 'riders' which give
   * details on the special abilities, then include it as part of the macro.
   *@param {string[]} data - The cleaned data from the gm notes field of the token
   * @returns {*} An object with a lot of name to string array name/value pairs of stuff parsed out.
   * TODO: add option for verbrocity during generaton.
   */
  var parseSpecials = function(data) {
    var retval = {};
    var charId = character.get("_id");
    var line = "";
    var lineStartFnd = 0;
    var lineEndFnd = data.length;
    var re, abName, action, actionStr, spList, hasSAtks;
    var saName = "";
    var sAtkStr = "";

    line = getLineByName("Special Attacks", data);
    if (line) {
      line = line.replace("Special Attacks", "");
      var sAtks = line.split(/,(?![^\(\)]*\))/);
      while (sAtks.length > 0) {
        if (!sAtks[0] || !sAtks[0].match(/[^\s]+/)) {
          sAtks.shift();
          continue;
        }
        var saNameArr = sAtks[0].match(/\b[^\d\(\)\+]+/g);
        if (saNameArr !== null) {
          saName = saNameArr[0].trim();
          sAtkStr += saName;
          if (!retval[saName]) {
            retval[saName] = new Array(sAtks[0].trim());
          } else {
            retval[saName].push(sAtks[0].trim());
          }
          creLog("parseSpecials " + sAtks[0] + " saName: " + saName, 1);
        }
        sAtks.shift();
      }
    }

    /* TODO add in nextLine support for cases where the special ability
		name is found on the following line(s) */
    lineStartFnd = getLineNumberByName("SPECIAL ABILITIES", data);
    if (lineStartFnd) {
      for (var i = lineStartFnd; i < data.length; ++i) {
        line = data[i];
        if (line.match(/\(Su\)|\(Ex\)|\(Sp\)/i)) {
          saName = line
            .substring(0, line.indexOf("("))
            .toLowerCase()
            .trim();
          re = new RegExp(saName, "ig");
          action =
            "!\n" +
            fields.menuWhis +
            line.replace(re, getTermLink(saName, termEnum.GENERAL));
          if (!retval[saName]) {
            retval[saName] = new Array(line.trim());
          } else {
            retval[saName].push(line.trim());
          }
          addAbility("SA-" + saName, "", action, false, charId);
        }
      }
    }

    /* If there is a special attack, that is a special attack not ability,
		then it is unique and should get its own ability as well as long-rider
		if one exists.*/
    spList =
      "!\n" +
      fields.menuWhis +
      menuTemplate.boundryImg({
        imgLink: design.specialTopImg
      }) +
      menuTemplate.midDiv({
        imgLink: design.specialMidImg
      }) +
      '<div style="text-align:center">' +
      menuTemplate.titleFmt({
        style: design.specialTitleFmt,
        title: creName
      }) +
      menuTemplate.titleFmt({
        style: design.specialLabelFmt,
        title: "Special Attacks"
      }) +
      "</div>";
    /*
		// DEPRECATED (exclude special attacks that are melee/ranged riders)
		// insure we have melee or ranged
		line = getLineByName("Melee",data)
			+ getLineByName("Ranged",data) + '';
		*/
    if (sAtkStr) {
      _.every(_.keys(retval), function(sAtks) {
        if (/*!line.match(sAtks) &&*/ sAtkStr.indexOf(sAtks) !== -1) {
          hasSAtks = true;
          abName = "SP-" + sAtks;
          abName = abName.replace(/\s/g, "-");
          action = "!\n" + fields.resultWhis;
          _.every(retval[sAtks], function(rider) {
            creLog("SP rider: " + rider, 3);
            re = new RegExp(sAtks, "ig");
            actionStr = "<div>" + getFormattedRoll(rider) + "</div>";
            action += actionStr.replace(
              re,
              getTermLink(sAtks, termEnum.GENERAL)
            );
            return true;
          });
          creLog("SP action: " + action, 3);
          addAbility(abName, "", action, false, charId);
          spList =
            spList +
            menuTemplate.midButton({
              riders: undefined,
              creName: creName,
              abName: abName,
              btnName: sAtks
            });
        }
        return true;
      });
    }
    if (hasSAtks) {
      spList =
        spList +
        "</div>" +
        menuTemplate.boundryImg({
          imgLink: design.specialBotImg
        });
      addAbility("Specials", "", spList, false, charId);
    }
    return retval;
  };

  /**
   * parseAttacks - parse melee and ranged attacks, if there are special attack riders,
   * then we will append the macro text
   *@param {string[]} data - The cleaned data from the gm notes field of the token
   * @param {*} specials - data returned by parseSpecials
   */
  var parseAttacks = function(data, specials) {
    var charId = character.get("_id");
    var line = "";
    var lineStartFnd = 0;
    var lineEndFnd = data.length;
    var atkMenu, CMB, riders;

    atkMenu =
      fields.menuWhis +
      menuTemplate.boundryImg({
        imgLink: design.atkMenuTopImg
      }) +
      menuTemplate.midDiv({
        imgLink: design.atkMenuMidImg
      }) +
      '<div style="text-align:center">' +
      menuTemplate.titleFmt({
        style: design.atkMenuTitleFmt,
        title: creName
      }) +
      menuTemplate.titleFmt({
        style: design.atkMenuLabelFmt,
        title: "Attacks"
      }) +
      "</div>";

    lineStartFnd = getLineNumberByName("OFFENSE", data);
    lineEndFnd = getLineNumberByName("TACTICS", data);
    if (!lineEndFnd) {
      lineEndFnd = getLineNumberByName("STATISTICS", data);
    }
    try {
      line = getLineByName("Melee", data, lineStartFnd, lineEndFnd);
      if (line) {
        formatAttacks(line, "Melee", charId, "ATK", specials);
        atkMenu =
          atkMenu +
          menuTemplate.midButton({
            riders: undefined,
            creName: creName,
            abName: "ATK",
            btnName: "Melee"
          });
      }
      line = getLineByName("Ranged", data, lineStartFnd, lineEndFnd);
      if (line) {
        formatAttacks(line, "Ranged", charId, "RNG", specials);
        atkMenu =
          atkMenu +
          menuTemplate.midButton({
            riders: undefined,
            creName: creName,
            abName: "RNG",
            btnName: "Ranged"
          });
      }
      var hasSAtk = findObjs({
        _type: "ability",
        name: "Specials",
        _characterid: charId
      });
      if (hasSAtk.length > 0) {
        atkMenu =
          atkMenu +
          menuTemplate.midButton({
            riders: undefined,
            creName: creName,
            abName: "Specials",
            btnName: "Specials"
          });
      }
      lineStartFnd = getLineNumberByName("STATISTICS", data);
      line = getLineByName("CMB", data, lineStartFnd);
      if (line) {
        CMB = getValueByName("CMB", line, [",", ";"]);
        riders = CMB.match(/\(.+\)/);
        addAttributeRoll("CMB", "CMB", false, false, charId, riders ? riders[0] : "");
        atkMenu =
          atkMenu +
          menuTemplate.midButton({
            riders: riders,
            creName: creName,
            abName: "CMB",
            btnName: "CMB"
          });
      }
    } catch (e) {
      log("ERROR when parsing attacks: ");
      throw e;
    }
    atkMenu =
      atkMenu +
      "</div>" +
      menuTemplate.boundryImg({
        imgLink: design.atkMenuBotImg
      });
    addAbility("Attacks", "", atkMenu, true, charId);
  };

  /** parseSpells - parse out spells the marco will spit them out, possibly even link
   * them to a known PRD search engine.
   *@param {string[]} data - The cleaned data from the gm notes field of the token
   */
  var parseSpells = function(data) {
    var charId = character.get("_id");
    var lineEndFnd = data.length;
    var casterType, attrName;
    var rc,
      line = "";
    var termChars = [";", ","];

    lineEndFnd = getLineNumberByName("TACTICS", data);
    if (!lineEndFnd) {
      {
        lineEndFnd = getLineNumberByName("STATISTICS", data);
      }
    }
    formatSpells(
      "Spell-Like Abilities",
      data,
      lineEndFnd,
      termEnum.GENERAL,
      "SLA"
    );
    formatSpells("Spells Known", data, lineEndFnd, termEnum.SPELL);
    formatSpells("Spells Prepared", data, lineEndFnd, termEnum.SPELL);
    formatSpells("Extracts Prepared", data, lineEndFnd, termEnum.SPELL);
  };

  /**
   * parseGeneric - Generic Parse assuming CSV on the line, Gear, Feats, SQ, etc.
   * @param {string} generic - the label to be parsed
   *@param {string[]} data - The cleaned data from the gm notes field of the token
   * @param {*} type - The type of the generic to create (termEnum)
   * @param {number=} [start] - the staring line from data to find generic in
   * @param {number=} [end] - the ending line from data to find generic in
   */
  var parseGeneric = function(generic, data, type, start, end) {
    if (!generic || !type) {
      return;
    }
    if (!start) {
      start = 0;
    }
    if (!end) {
      end = data.length;
    }
    var charId = character.get("_id");
    var genName, genRiders, genAry, idx, genList, abName, genLabel;
    var lineStartFnd = 0;
    var rc,
      line = "";
    var termChars = [";"];

    genList =
      "!\n" +
      fields.menuWhis +
      menuTemplate.boundryImg({
        imgLink: design.genTopImg
      }) +
      menuTemplate.midDiv({
        imgLink: design.genMidImg
      }) +
      '<div style="text-align:center">' +
      menuTemplate.titleFmt({
        style: design.genTitleFmt,
        title: creName
      }) +
      menuTemplate.titleFmt({
        style: design.genLabelFmt,
        title: generic
      }) +
      "</div>";

    line = getLineByName(generic, data, start, end);
    line = getValueByName(generic, line, termChars);
    creLog("parseGeneric: " + line, 1);
    if (line) {
      line = line.replace(generic, "");
      genAry = line.split(/,(?![^\(\)]*\))/);
      if (genAry) {
        _.every(genAry, function(elemGen) {
          if ((idx = elemGen.indexOf("(")) !== -1) {
            genName = elemGen.substring(0, idx).trim();
            genRiders = elemGen.substring(idx).trim();
          } else {
            genName = elemGen.trim();
            genRiders = undefined;
          }
          genName = formatSuperSubScript(genName);
          genList =
            genList +
            menuTemplate.midLink({
              riders: genRiders,
              link: getTermLink(genName, type)
            });
          return true;
        });
        genList =
          genList +
          "</div>" +
          menuTemplate.boundryImg({
            imgLink: design.genBotImg
          });
        addAbility(generic, "", genList, false, charId);
      }
    }
  };

  /**
   * parseSkills - parse out skills the marco will spit them out, possibly even link
   * them to a known PRD search engine.
   *@param {string[]} data - The cleaned data from the gm notes field of the token
   */
  var parseSkills = function(data) {
    var charId = character.get("_id");
    var lineStartFnd = 0;
    var lineEndFnd = data.length;
    var skillName,
      skillRiders,
      skillAry,
      skillList,
      abName,
      skillLabel,
      parts,
      abStr,
      racialBonus,
      racialAry,
      racialRiders;
    var rc,
      line = "";
    var termChars = [";", ","];

    skillList =
      "!\n" +
      fields.menuWhis +
      menuTemplate.boundryImg({
        imgLink: design.skillTopImg
      }) +
      menuTemplate.midDiv({
        imgLink: design.skillMidImg
      }) +
      '<div style="text-align:center">' +
      menuTemplate.titleFmt({
        style: design.skillTitleFmt,
        title: creName
      }) +
      menuTemplate.titleFmt({
        style: design.skillLabelFmt,
        title: "Skills"
      }) +
      "</div>";

    lineStartFnd = getLineNumberByName("STATISTICS", data);
    line = getLineByName("Skills", data, lineStartFnd);
    if (line) {
      line = line.replace("Skills", "");
      skillAry = line.split(/,(?![^\(\)]*\))|;(?![^\(\)]*\))/);
      if (skillAry.length > 0) {
        _.every(skillAry, function(skill) {
          if (!skill || !skill.match(/[^\s]+/)) {
            creLog("invalid: " + skill, 2);
            return true;
          }
          creLog(skill, 4);
          if ((parts = skill.match(/\b[^\d\+\-/]+/)) !== -1) {
            skillName = parts[0].trim();
            creLog("parseSkills: skillName: " + skillName, 5);
            skillRiders = skill
              .substring(skill.indexOf(skillName) + skillName.length)
              .match(/\(.+\)/);
          }
          if (skillName.match("Racial Modifiers")) {
            creLog("parseSkills: Ending skills, reason : " + skillName, 4);
            return false;
          }
          rc = getBonusNumber(skill);
          skillName = formatSuperSubScript(skillName);
          abName = "SK-" + skillName;
          abName = abName.replace(/\s/g, "-");
          abStr =
            "!\n" +
            fields.resultWhis +
            creName +
            " " +
            abName +
            " [[1d20" +
            rc +
            "]]";
          addAbility(abName, "", abStr, false, charId);
          skillList =
            skillList +
            menuTemplate.midButton({
              riders: skillRiders,
              creName: creName,
              abName: abName,
              btnName: skillName
            });
          return true;
        });
      }
      if (!characterObjExists("SK-Perception", "ability", charId)) {
        lineEndFnd = getLineNumberByName("DEFENSE", data);
        line = getLineByName("Perception", data, 0, lineEndFnd);
        rc = getValueByName("Perception", line, termChars);
        rc = getBonusNumber(rc, bonusEnum.SIGN);
        abName = "SK-Perception";
        abStr =
          "!\n" +
          fields.resultWhis +
          creName +
          " " +
          abName +
          " [[1d20" +
          rc +
          "]]";
        addAbility(abName, "", abStr, false, charId);
        skillList =
          skillList +
          menuTemplate.midButton({
            riders: skillRiders,
            creName: creName,
            abName: abName,
            btnName: "Perception"
          });
      }
      skillList =
        skillList +
        "</div>" +
        menuTemplate.boundryImg({
          imgLink: design.skillBotImg
        });
      addAbility("Skills", "", skillList, false, charId);
    }
  };

  /**
   * parseDefenses - parses defenses
   *@param {string[]} data - The cleaned data from the gm notes field of the token
   */
  var parseDefenses = function(data) {
    // TODO: this function does way too much

    var retVal;
    var charId = character.get("_id");
    var line = "";
    var lineStartFnd = 0;
    var lineEndFnd = data.length;
    var termChars = [";"];
    var excluded = ["SR", "DR", "Immune", "Resist", "Weaknesses"]; //TODO compensate for missing delimiters (SR on black dragons vs succubus)
    var rc = -1;
    var i = 0;
    var SR,
      DR,
      CMD,
      defenseAb,
      riders,
      name,
      resist,
      immune,
      weak,
      senses,
      speed,
      regen,
      aura,
      fasthealing,
      aryList,
      hasDefense = false;
    var defenseList;

    var fmtLinkFunc = function(arg) {
      arg = arg.trim();
      var nameArr = arg.match(/\b[^\(\)]+/);
      name = formatSuperSubScript(nameArr[0]);
      var riders = arg.match(/\(.+\)/);
      return menuTemplate.midLinkFree({
        riders: riders,
        link: getTermLink(name, termEnum.GENERAL)
      });
    };

    var fmtLeadFunc = function(arg) {
      var list = arg.split("%%");
      if (list.length !== 2) {
        throw "ERROR: Bad Arg";
      }
      var label = list[0];
      var riders = list[1].match(/\(.+\)/);
      var value = list[1].match(/\b[^\(\)]+/);
      if (!value) {
        value = "—";
      }
      value = value[0].trim();
      return menuTemplate.midLeadText({
        riders: riders,
        label: label,
        text: value
      });
    };
    var fmtTextFunc = function(arg) {
      var riders = arg.match(/\(.+\)/);
      var value = arg.match(/\b[^\(\)]+/);
      if (!value) {
        value = "—";
      }
      value = value[0].trim();
      return menuTemplate.midText({
        riders: riders,
        text: value
      });
    };

    defenseList =
      "!\n" +
      fields.menuWhis +
      menuTemplate.boundryImg({
        imgLink: design.genTopImg
      }) +
      menuTemplate.midDiv({
        imgLink: design.genMidImg
      }) +
      '<div style="text-align:center;">' +
      menuTemplate.titleFmt({
        style: design.genTitleFmt,
        title: creName
      }) +
      menuTemplate.titleFmt({
        style: design.genLabelFmt,
        title: "Defenses"
      }) +
      "</div>";

    lineStartFnd = getLineNumberByName("DEFENSE", data);
    lineEndFnd = getLineNumberByName("OFFENSE", data);
    line = getLineByName("DR", data, lineStartFnd, lineEndFnd);
    if (line) {
      DR = getValueByName("DR", line, termChars);
    }
    line = getLineByName("SR", data, lineStartFnd, lineEndFnd);
    if (line) {
      SR = getValueByName("SR", line, termChars);
    }
    line = getLineByName("Immune", data, lineStartFnd, lineEndFnd);
    if (line) {
      immune = getValueByName("Immune", line, termChars);
    }
    line = getLineByName("Resist", data, lineStartFnd, lineEndFnd);
    if (line) {
      resist = getValueByName("Resist", line, termChars);
    }
    line = getLineByName("Defensive Abilities", data, lineStartFnd, lineEndFnd);
    if (line) {
      defenseAb = getValueByName("Defensive Abilities", line, termChars);
    }
    line = getLineByName("Weaknesses", data, lineStartFnd, lineEndFnd);
    if (line) {
      weak = getValueByName("Weaknesses", line, termChars);
    }
    // add Fast Healing
    line = getLineByName("fast healing", data, 0, lineEndFnd);
    if (line) {
      fasthealing = getValueByName("fast healing", line, termChars);
    }
    // add Regeneration
    line = getLineByName("regeneration", data, 0, lineEndFnd);
    if (line) {
      regen = getValueByName("regeneration", line, termChars);
    }
    // add CMD
    lineStartFnd = getLineNumberByName("STATISTICS", data);
    line = getLineByName("CMD", data, lineStartFnd);
    if (line) {
      CMD = getValueByName("CMD", line, [",", ";"]);
    }
    // add Senses
    lineEndFnd = getLineNumberByName("DEFENSE", data);
    line = getLineByName("Senses", data, 0, lineEndFnd);
    if (line) {
      senses = getValueByName("Senses", line, termChars);
    }
    // add Aura
    line = getLineByName("Aura", data, 0, lineEndFnd);
    if (line) {
      aura = getValueByName("Aura", line, termChars);
    }
    // add Speed
    lineStartFnd = getLineNumberByName("OFFENSE", data);
    lineEndFnd = getLineNumberByName("TACTICS", data);
    if (!lineEndFnd) {
      lineEndFnd = getLineNumberByName("STATISTICS", data);
    }
    line = getLineByName("Speed", data, lineStartFnd, lineEndFnd);
    if (line) {
      speed = getValueByName("Speed", line, termChars);
    }

    if (CMD) {
      hasDefense = true;
      defenseList =
        defenseList + "<div>" + fmtLeadFunc("CMD:%%" + CMD) + "</div>";
    }

    if (regen) {
      hasDefense = true;
      defenseList =
        defenseList +
        "<div>" +
        fmtLeadFunc("Regeneration:%%" + regen) +
        "</div>";
    }

    if (fasthealing) {
      hasDefense = true;
      defenseList =
        defenseList +
        "<div>" +
        fmtLeadFunc("Fast Healing:%%" + fasthealing) +
        "</div>";
    }

    if (DR || SR) {
      hasDefense = true;
      defenseList += "<div>";
      if (DR && SR) {
        defenseList =
          defenseList +
          formatTable(["DR:%%" + DR, "SR:%%" + SR], 2, fmtLeadFunc);
      } else if (DR) {
        defenseList = defenseList + fmtLeadFunc("DR:%%" + DR);
      } else if (SR) {
        defenseList = defenseList + fmtLeadFunc("SR:%%" + SR);
      }
      defenseList += "</div>";
    }

    if (speed) {
      hasDefense = true;
      aryList = speed.split(/,(?![^\(\)]*\))|;(?![^\(\)]*\))/);
      defenseList =
        defenseList +
        '<div style="text-align:center;">' +
        '<span style="font-weight: bold; color: #000000;">' +
        "Speed:" +
        "</span>" +
        "</div>";
      if (aryList.length >= 2) {
        defenseList +=
          "<div>" + formatTable(aryList, 2, fmtTextFunc) + "</div>";
      } else if (aryList.length > 0) {
        for (i = 0; i < aryList.length; i++) {
          if (!aryList[i] || !aryList[i].match(/[^\s]+/)) {
            continue;
          }
          defenseList =
            defenseList + "<div>" + fmtTextFunc(aryList[i]) + "</div>";
        }
      }
    }

    if (senses) {
      hasDefense = true;
      aryList = senses.split(/,(?![^\(\)]*\))|;(?![^\(\)]*\))/);
      defenseList =
        defenseList +
        '<div style="text-align:center;">' +
        '<span style="font-weight: bold; color: #000000;">' +
        "Senses:" +
        "</span>" +
        "</div>";
      if (aryList.length > 3) {
        defenseList +=
          "<div>" + formatTable(aryList, 2, fmtLinkFunc) + "</div>";
      } else if (aryList.length > 0) {
        for (i = 0; i < aryList.length; i++) {
          if (!aryList[i] || !aryList[i].match(/[^\s]+/)) {
            continue;
          }
          defenseList =
            defenseList + "<div>" + fmtLinkFunc(aryList[i]) + "</div>";
        }
      }
    }

    if (aura) {
      hasDefense = true;
      aryList = aura.split(/,(?![^\(\)]*\))|;(?![^\(\)]*\))/);
      defenseList =
        defenseList +
        '<div style="text-align:center;">' +
        '<span style="font-weight: bold; color: #000000;">' +
        "Aura:" +
        "</span>" +
        "</div>";
      if (aryList.length > 3) {
        defenseList +=
          "<div>" + formatTable(aryList, 2, fmtLinkFunc) + "</div>";
      } else if (aryList.length > 0) {
        for (i = 0; i < aryList.length; i++) {
          if (!aryList[i] || !aryList[i].match(/[^\s]+/)) {
            continue;
          }
          defenseList =
            defenseList + "<div>" + fmtLinkFunc(aryList[i]) + "</div>";
        }
      }
    }

    if (immune) {
      hasDefense = true;
      aryList = immune.split(/,(?![^\(\)]*\))|;(?![^\(\)]*\))/);
      defenseList =
        defenseList +
        '<div style="text-align:center;">' +
        '<span style="font-weight: bold; color: #000000;">' +
        "Immunities:" +
        "</span>" +
        "</div>";
      if (aryList.length > 3) {
        defenseList +=
          "<div>" + formatTable(aryList, 2, fmtLinkFunc) + "</div>";
      } else if (aryList.length > 0) {
        for (i = 0; i < aryList.length; i++) {
          if (!aryList[i] || !aryList[i].match(/[^\s]+/)) {
            continue;
          }
          defenseList =
            defenseList + "<div>" + fmtLinkFunc(aryList[i]) + "</div>";
        }
      }
    }

    if (resist) {
      hasDefense = true;
      aryList = resist.split(/,(?![^\(\)]*\))|;(?![^\(\)]*\))/);
      defenseList =
        defenseList +
        '<div style="text-align:center">' +
        '<span style="font-weight: bold; color: #000000;">' +
        "Resistances:" +
        "</span>" +
        "</div>";
      if (aryList.length > 3) {
        defenseList +=
          "<div>" + formatTable(aryList, 2, fmtLinkFunc) + "</div>";
      } else if (aryList.length > 0) {
        for (i = 0; i < aryList.length; i++) {
          if (!aryList[i] || !aryList[i].match(/[^\s]+/)) {
            continue;
          }
          defenseList =
            defenseList +
            '<div style="text-align:center">' +
            fmtLinkFunc(aryList[i]) +
            "</div>";
        }
      }
    }

    if (weak) {
      hasDefense = true;
      aryList = weak.split(/,(?![^\(\)]*\))|;(?![^\(\)]*\))/);
      defenseList =
        defenseList +
        '<div style="text-align:center">' +
        '<span style="font-weight: bold; color: #000000;">' +
        "Weaknesses:" +
        "</span>" +
        "</div>";
      if (aryList.length > 3) {
        defenseList +=
          "<div>" + formatTable(aryList, 2, fmtLinkFunc) + "</div>";
      } else if (aryList.length > 0) {
        for (i = 0; i < aryList.length; i++) {
          if (!aryList[i] || !aryList[i].match(/[^\s]+/)) {
            continue;
          }
          defenseList =
            defenseList +
            '<div style="text-align:center">' +
            fmtLinkFunc(aryList[i]) +
            "</div>";
        }
      }
    }

    if (defenseAb) {
      hasDefense = true;
      aryList = defenseAb.split(/,(?![^\(\)]*\))|;(?![^\(\)]*\))/);
      defenseList =
        defenseList +
        '<div style="text-align:center">' +
        '<span style="font-weight: bold; color: #000000;">' +
        "Defensive Abilities:" +
        "</span>" +
        "</div>";
      if (aryList.length > 3) {
        defenseList +=
          "<div>" + formatTable(aryList, 2, fmtLinkFunc) + "</div>";
      } else if (aryList.length > 0) {
        for (i = 0; i < aryList.length; i++) {
          if (!aryList[i] || !aryList[i].match(/[^\s]+/)) {
            continue;
          }
          defenseList =
            defenseList +
            '<div style="text-align:center">' +
            fmtLinkFunc(aryList[i]) +
            "</div>";
        }
      }
    }

    defenseList =
      defenseList +
      "</div>" +
      menuTemplate.boundryImg({
        imgLink: design.genBotImg
      });

    if (hasDefense) {
      addAbility("Defenses", "", defenseList, false, charId);
    }
  };

  /**
   * formatTable - format a table given a minimum column length and a format function for
   * the elements.
   */
  var formatTable = function(aryList, minCol, fmtFunc) {
    if (!aryList || !minCol) {
      return undefined;
    }
    if (!fmtFunc) {
      fmtFunc = function(arg) {
        return arg;
      };
    }

    var retval = '<table style="margin-left: auto; margin-right: auto;">';
    var i, j;

    for (i = 0; i < aryList.length; i += minCol) {
      retval += "<tr>";
      if (aryList.length - i + 1 > minCol) {
        for (j = i; j < i + minCol; ++j) {
          if (!aryList[j] || !aryList[j].match(/[^\s]+/)) {
            continue;
          }
          retval += "<td>" + fmtFunc(aryList[j]) + "</td>";
        }
      } else {
        // span the last column
        for (j = i; j < aryList.length - 1; ++j) {
          if (!aryList[j] || !aryList[j].match(/[^\s]+/)) {
            continue;
          }
          retval += "<td>" + fmtFunc(aryList[j]) + "</td>";
        }
        retval +=
          '<td colspan="' +
          (minCol - (j % minCol)) +
          '">' +
          fmtFunc(aryList[aryList.length - 1]) +
          "</td>";
        retval += "</tr>";
        break;
      }
      retval += "</tr>";
    }

    // clean up remainder here
    retval += "</table>";
    return retval;
  };

  /**
   * Parse out special abilities (not special attacks) and put them in a
   * menu, if there are no special abilities, create no such menu
   * @param {*} specials - data returned by parseSpecials
   */
  var parseSpecialMenu = function(specials) {
    if (!specials) {
      return;
    }
    var charId = character.get("_id");
    var spMenu,
      saName,
      hasSpecials = false;

    spMenu =
      "!\n" +
      fields.menuWhis +
      menuTemplate.boundryImg({
        imgLink: design.genTopImg
      }) +
      menuTemplate.midDiv({
        imgLink: design.genMidImg
      }) +
      '<div style="text-align:center">' +
      menuTemplate.titleFmt({
        style: design.genTitleFmt,
        title: creName
      }) +
      menuTemplate.titleFmt({
        style: design.genLabelFmt,
        title: "Special Abilities"
      }) +
      "</div>";

    _.every(_.keys(specials), function(key) {
      saName = "SA-" + key;
      if (characterObjExists(saName, "ability", charId)) {
        hasSpecials = true;
        spMenu =
          spMenu +
          menuTemplate.midButton({
            riders: undefined,
            creName: creName,
            abName: saName,
            btnName: key
          });
      }
      return;
    });

    spMenu =
      spMenu +
      "</div>" +
      menuTemplate.boundryImg({
        imgLink: design.genBotImg
      });

    if (hasSpecials) {
      addAbility("Special Abilities", "", spMenu, false, charId);
    }
  };

  /**
   * parseItems - Parses Gear
   *@param {string[]} data - The cleaned data from the gm notes field of the token
   */
  var parseItems = function(data) {
    var charId = character.get("_id");
    var menu,
      hasGear = false;
    var start, end;

    menu =
      "!\n" +
      fields.menuWhis +
      menuTemplate.boundryImg({
        imgLink: design.genTopImg
      }) +
      menuTemplate.midDiv({
        imgLink: design.genMidImg
      }) +
      '<div style="text-align:center">' +
      menuTemplate.titleFmt({
        style: design.genTitleFmt,
        title: creName
      }) +
      menuTemplate.titleFmt({
        style: design.genLabelFmt,
        title: "Items"
      }) +
      "</div>";

    start = getLineNumberByName("STATISTICS", data);
    end = getLineNumberByName("SPECIAL ABILITIES", data);

    // parse Combat Gear
    parseGeneric("Combat Gear", data, termEnum.GENERAL, start, end); // fixed bug - was missing data parameter
    if (characterObjExists("Combat Gear", "ability", charId)) {
      hasGear = true;
      menu =
        menu +
        menuTemplate.midButton({
          riders: undefined,
          creName: creName,
          abName: "Combat Gear",
          btnName: "Gear-Combat"
        });
    }

    // parse Other Gear
    parseGeneric("Other Gear", data, termEnum.GENERAL, start, end); // fixed bug - was missing data parameter
    if (characterObjExists("Other Gear", "ability", charId)) {
      hasGear = true;
      menu =
        menu +
        menuTemplate.midButton({
          riders: undefined,
          creName: creName,
          abName: "Other Gear",
          btnName: "Gear-Other"
        });
    }
    if (!hasGear) {
      // parse General Gear
      parseGeneric("Gear", data, termEnum.GENERAL, start, end);
      if (characterObjExists("Gear", "ability", charId)) {
        hasGear = true;
        menu =
          menu +
          menuTemplate.midButton({
            riders: undefined,
            creName: creName,
            abName: "Gear",
            btnName: "Gear"
          });
      }
    }

    menu =
      menu +
      "</div>" +
      menuTemplate.boundryImg({
        imgLink: design.genBotImg
      });

    if (hasGear) {
      addAbility("Items", "", menu, false, charId);
    }
  };

  /**
   * parseTactics - Parses Tactics
   *@param {string[]} data - The cleaned data from the gm notes field of the token
   */
  var parseTactics = function(data) {
    var charId = character.get("_id");
    var menu,
      hasTactics = false;
    var start, end, line;

    menu =
      "!\n" +
      fields.menuWhis +
      menuTemplate.boundryImg({
        imgLink: design.genTopImg
      }) +
      menuTemplate.midDiv({
        imgLink: design.genMidImg
      }) +
      '<div style="text-align:center">' +
      menuTemplate.titleFmt({
        style: design.genTitleFmt,
        title: creName
      }) +
      menuTemplate.titleFmt({
        style: design.genLabelFmt,
        title: "Tactics"
      }) +
      "</div>";

    start = getLineNumberByName("TACTICS", data);
    end = getLineNumberByName("STATISTICS", data);

    // Before Combat
    line = getLineByName("Before Combat", data, start, end);
    if (line) {
      hasTactics = true;
      line = line.replace("Before Combat", "<b>Before Combat</b>");
      line = "!\n" + fields.privWhis + line;
      addAbility("Tactics-Before", "", line, false, charId);
      menu =
        menu +
        menuTemplate.midButton({
          riders: undefined,
          creName: creName,
          abName: "Tactics-Before",
          btnName: "Before Combat"
        });
    }
    // During Combat
    line = getLineByName("During Combat", data, start, end);
    if (line) {
      hasTactics = true;
      line = line.replace("During Combat", "<b>During Combat</b>");
      line = "!\n" + fields.privWhis + line;
      addAbility("Tactics-During", "", line, false, charId);
      menu =
        menu +
        menuTemplate.midButton({
          riders: undefined,
          creName: creName,
          abName: "Tactics-During",
          btnName: "During Combat"
        });
    }
    // Morale
    line = getLineByName("Morale", data, start, end);
    if (line) {
      hasTactics = true;
      line = line.replace("Morale", "<b>Morale</b>");
      line = "!\n" + fields.privWhis + line;
      addAbility("Tactics-Morale", "", line, false, charId);
      menu =
        menu +
        menuTemplate.midButton({
          riders: undefined,
          creName: creName,
          abName: "Tactics-Morale",
          btnName: "Morale"
        });
    }

    menu =
      menu +
      "</div>" +
      menuTemplate.boundryImg({
        imgLink: design.genBotImg
      });
    if (hasTactics) {
      addAbility("Tactics", "", menu, false, charId);
    }
  };

  /**
   * parse additional, non-combat abilities
   *@param {string[]} data - The cleaned data from the gm notes field of the token
   * @param {*} specials - data returned by parseSpecials
   */
  var parseExtra = function(data, specials) {
    var charId = character.get("_id");
    var menu,
      hasExtras = false;

    menu =
      fields.menuWhis +
      menuTemplate.boundryImg({
        imgLink: design.genTopImg
      }) +
      menuTemplate.midDiv({
        imgLink: design.genMidImg
      }) +
      '<div style="text-align:center">' +
      menuTemplate.titleFmt({
        style: design.genTitleFmt,
        title: creName
      }) +
      menuTemplate.titleFmt({
        style: design.genLabelFmt,
        title: "Abilities"
      }) +
      "</div>";

    // parse skills
    parseSkills(data);
    if (characterObjExists("Skills", "ability", charId)) {
      hasExtras = true;
      menu =
        menu +
        menuTemplate.midButton({
          riders: undefined,
          creName: creName,
          abName: "Skills",
          btnName: "Skills"
        });
    }
    // parse feats
    parseGeneric("Feats", data, termEnum.FEAT);
    if (characterObjExists("Feats", "ability", charId)) {
      hasExtras = true;
      menu =
        menu +
        menuTemplate.midButton({
          riders: undefined,
          creName: creName,
          abName: "Feats",
          btnName: "Feats"
        });
    }
    // parse SQ
    parseGeneric("SQ", data, termEnum.GENERAL);
    if (characterObjExists("SQ", "ability", charId)) {
      hasExtras = true;
      menu =
        menu +
        menuTemplate.midButton({
          riders: undefined,
          creName: creName,
          abName: "SQ",
          btnName: "SQ"
        });
    }
    // parse Defenses
    parseDefenses(data);
    if (characterObjExists("Defenses", "ability", charId)) {
      hasExtras = true;
      menu =
        menu +
        menuTemplate.midButton({
          riders: undefined,
          creName: creName,
          abName: "Defenses",
          btnName: "Defenses"
        });
    }
    // parse Tactics
    parseTactics(data);
    if (characterObjExists("Tactics", "ability", charId)) {
      hasExtras = true;
      menu =
        menu +
        menuTemplate.midButton({
          riders: undefined,
          creName: creName,
          abName: "Tactics",
          btnName: "Tactics"
        });
    }
    // parse special abilities
    parseSpecialMenu(specials);
    if (characterObjExists("Special Abilities", "ability", charId)) {
      hasExtras = true;
      menu =
        menu +
        menuTemplate.midButton({
          riders: undefined,
          creName: creName,
          abName: "Special Abilities",
          btnName: "Special Abilities"
        });
    }
    // parse items
    parseItems(data);
    if (characterObjExists("Items", "ability", charId)) {
      hasExtras = true;
      menu =
        menu +
        menuTemplate.midButton({
          riders: undefined,
          creName: creName,
          abName: "Items",
          btnName: "Items"
        });
    }

    menu =
      menu +
      "</div>" +
      menuTemplate.boundryImg({
        imgLink: design.genBotImg
      });

    if (hasExtras) {
      addAbility("Abilities", "", menu, true, charId);
    }
  };

  /**
   * formatSpells - Format spells
   * @param {string} type - the label to be parsed
   *@param {string[]} data - The cleaned data from the gm notes field of the token
   * @param {number} end - the ending line from data to find generic in
   * @param {*} termType - The type of the generic to create (termEnum)
   * @param {string=} [suffix] - To allow adding SLA suffix
   */
  var formatSpells = function(type, data, end, termType, suffix) {
    if (!type || !end || !termType) {
      return undefined;
    }
    var charId = character.get("_id");
    var start,
      casterType,
      conAttrName,
      clAttrName,
      sLevel,
      spells,
      rc,
      line,
      casterLevel,
      concentration,
      spellBook,
      abName,
      attrStr;
    var termChars = [";", ","];

    start = getLineNumberByName(type, data);
    while (start && !!(line = getLineByName(type, data, start, end))) {
      if (line) {
        line = getLineByName(type, data, start, end);
        casterType = line.substring(0, line.indexOf(type)).trim();
        casterType = casterType.replace(/\s+/g, "-");
        if (casterType === "") {
          casterType = "Base";
        }
        casterType += suffix ? "-" + suffix : "";
        casterLevel = getValueByName("CL", line, termChars);
        casterLevel = getBonusNumber(casterLevel, bonusEnum.SCALAR);
        creLog("SpellFormat: casterType: " + casterType, 2);
        clAttrName = casterType + "-CL";
        addAttribute(clAttrName, casterLevel, casterLevel, charId);
        attrStr =
          "!\n" +
          fields.resultWhis +
          creName +
          ": " +
          clAttrName +
          ": [[1d20+" +
          casterLevel +
          "]]";
        addAbility(clAttrName, "", attrStr, false, charId);
        concentration = getValueByName("concentration", line, termChars);
        concentration = getBonusNumber(concentration, bonusEnum.SIGN);
        conAttrName = casterType + "-CON";
        addAttribute(conAttrName, concentration, concentration, charId);
        if (!concentration) {
					creLogWarning("No concentration bonus found for '" + casterType + "' " + type + ". A manual prompt has been substituted in place.");
        }
				attrStr = "!\n" + fields.resultWhis + creName + ": " + conAttrName + ": [[1d20" +
					(concentration ? concentration : "+?{concentration-bonus}") + "]]";
        addAbility(conAttrName, "", attrStr, false, charId);
        start++;

        spellBook =
          fields.menuWhis +
          menuTemplate.boundryImg({
            imgLink: design.spellBookTopImg
          }) +
          (design.spellBookMidOvr
            ? menuTemplate.midDivOverlay({
                imgLink: design.spellBookMidImg,
                imgLinkOverlay: design.spellBookMidOvr
              })
            : menuTemplate.midDiv({
                imgLink: design.spellBookMidImg
              })) +
          '<div style="text-align:center">' +
          menuTemplate.titleFmt({
            style: design.spellBookTitleFmt,
            title: casterType
          }) +
          "</div>";

        creLog("ParseSpells: start: " + start + " line: " + line, 1);
        // mow down some lines wherever we see —, stop when we don't see it.
        for (var i = start; i < end; ++i) {
          line = data[i];
          creLog("formatSpells: line " + line, 2);
          if (line.match("—")) {
            spells = line.split("—");
            if (spells.length < 2) {
              throw "ERROR: Bad spell list format";
            }
            sLevel = spells[0];
            spells = spells[1].split(/,(?![^\(\)]*\))/);
            creLog("spells sl: " + sLevel + " sp: " + spells, 2);
            addSpells(
              casterLevel,
              sLevel,
              spells,
              termType,
              casterType,
              charId
            );
            abName = casterType + " " + sLevel;
            spellBook =
              spellBook +
              menuTemplate.midButton({
                riders: undefined,
                creName: creName,
                abName: abName,
                btnName: sLevel
              });
          } else {
            break;
          }
        }

        if (casterType) {
          // put in CL and CON check buttons
          spellBook =
            spellBook +
            "<div>##</div>" +
            '<div style="font-weight: bold;">' +
            menuTemplate.midButtonFree({
              riders: undefined,
              creName: creName,
              abName: clAttrName,
              btnName: "CL"
            }) +
            "\t" +
            menuTemplate.midButtonFree({
              riders: undefined,
              creName: creName,
              abName: conAttrName,
              btnName: "CON"
            }) +
            "</div>" +
            (design.spellBookMidOvr ? "</td></tr></table>" : "") + // table-centering
            "</div>" + // BG
            menuTemplate.boundryImg({
              imgLink: design.spellBookBotImg
            });
          abName = casterType;
          addAbility(abName, "", spellBook, true, charId);
        }
        // Should be safe if we're under the assumption that there is at
        // least one ability given the stat block defined that it has abilities
        // of this type
        start = getLineNumberByName(type, data, start + 1, end);
      }
    }
  };

  /**
   * addSpells - add spells, be wary of greater/lesser semantics..
   * @param {number} casterLevel - the level of the caster!
   * @param {string} spellLvl - the level of the caster!
   * @param {*} spellAry - the array of strings of spell info parsed
   * @param {*} termType - The type of the generic to create (termEnum)
   * @param {string} setName - the type of the caster
   * @param {number} charId - the id for the character being created
   */
  var addSpells = function(
    casterLevel,
    spellLvl,
    spellAry,
    termType,
    setName,
    charId
  ) {
    if (!spellLvl || !spellAry || !setName || !termType || !charId) {
      return;
    }
    var spellName, spellRiders, spellLabel, idx, abName;
    var spellList = "";

    spellList =
      "!\n" +
      fields.menuWhis +
      menuTemplate.boundryImg({
        imgLink: design.spellTopImg
      }) +
      menuTemplate.midDiv({
        imgLink: design.spellMidImg
      }) +
      '<div style="text-align:center">' +
      menuTemplate.titleFmt({
        style: design.spellTitleFmt,
        title: setName
      }) +
      menuTemplate.titleFmt({
        style: design.spellLabelFmt,
        title: spellLvl + " CL(" + casterLevel + ")"
      }) +
      "</div>";

    while (spellAry.length > 0) {
      if (!spellAry[0] || !spellAry[0].match(/[^\s]+/)) {
        spellAry.shift();
        continue;
      }
      spellAry[0] = spellAry[0].trim();
      if ((idx = spellAry[0].indexOf("(")) !== -1) {
        spellName = spellAry[0].substring(0, idx).trim();
        spellRiders = spellAry[0].substring(idx).trim();
      } else {
        spellName = spellAry[0].trim();
        spellRiders = undefined;
      }
      // elminate badly formatted trailing commas
      if (spellName === "" || !spellName) {
        throw "ERROR: bad spell name: " + spellName;
      }
      // Invert to treat special names, link to the base spell in the label
      spellName = formatSuperSubScript(spellName);
      spellLabel = formatSpellStrength(spellName);
      creLog("spell name: " + spellName + " spellRiders: " + spellRiders, 2);

      //d20pfsrd uses - rather than %20
      spellLabel = spellLabel.replace(/\s+/g, "-");
      spellList =
        spellList +
        menuTemplate.midLinkCaption({
          riders: spellRiders,
          link: getTermLink(spellLabel, termType, spellName)
        });
      spellAry.shift();
    }
    spellList =
      spellList +
      "</div>" +
      menuTemplate.boundryImg({
        imgLink: design.spellBotImg
      });
    abName = setName + " " + spellLvl;
    addAbility(abName, "", spellList, false, charId);
  };

  /**
   * formatSpellStrength - A fancy way of saying, 'deal with greater/lesser/(numeral) for spell names'.
   * this is for term linking as the PRD and PFSRD refer to a single page for all
   * strength varients.
   * @param {string} spellName - the name to be formatted better
   * @returns {string} - the edited spell name
   */
  var formatSpellStrength = function(spellName) {
    if (!spellName) {
      return undefined;
    }
    var retval = spellName;
    var strengths = [
      "mass",
      "lesser",
      "greater",
      "IX",
      "VIII",
      "VII",
      "VI",
      "IV",
      "V",
      "III",
      "II",
      "I"
    ];

    _.every(strengths, function(level) {
      if (spellName.indexOf(level) !== -1) {
        retval = spellName.replace(level, "").trim();
        return false;
      }
      return true;
    });
    return retval;
  };

  /**
   * formatSuperSubScript - Given a string which we recognize as a legal name (spell/feat/whatever)
   * and, which we suspect may have a superscript or subscript; remove it.
   * @param {string} str - the string to try to remove a bunch book name superscripts from.
   * @return the cleaned up string
   */
  var formatSuperSubScript = function(str) {
    if (!str) {
      return undefined;
    }
    var retval = str;
    var cases = [
      "1st",
      "2nd",
      "3rd",
      "4th",
      "5th",
      "6th",
      "7th",
      "8th",
      "9th",
      "UM",
      "TG",
      "UC",
      "APG",
      "MC",
      "D",
      "B"
    ];
    var endsWith = function(str, suffix) {
      return str.indexOf(suffix, str.length - suffix.length) !== -1;
    };

    _.every(cases, function(subscript) {
      if (endsWith(str, subscript)) {
        retval = str.replace(subscript, "").trim();
        return false;
      }
      return true;
    });

    return retval;
  };

  /**
   * formatAttacks - Format attacks
   * @param {string} str - the string containing the attack information
   * @param {string} type - the type of the attack ('Melee' or 'Ranged')
   * @param {any} charId - character ID
   * @param {string} label - the label for the type of attack ('ATK', 'RNG', etc.)
   * @param {any} specials - the results from parseSpecials
   */
  var formatAttacks = function(str, type, charId, label, specials) {
    if (!str || !type || !charId) {
      return;
    }
    if (!label) {
      label = type;
    }
    var volley, attacks, atkList;
    var cnt = 0;
    var alphabet = [
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "H",
      "I",
      "J",
      "K",
      "L",
      "M",
      "N",
      "O",
      "P",
      "Q",
      "R",
      "S",
      "T",
      "U",
      "V",
      "W",
      "X",
      "Y",
      "Z"
    ];

    atkList =
      "!\n" +
      fields.menuWhis +
      menuTemplate.boundryImg({
        imgLink: design.atkTopImg
      }) +
      menuTemplate.midDiv({
        imgLink: design.atkMidImg
      }) +
      '<div style="text-align:center">' +
      menuTemplate.titleFmt({
        style: design.atkTitleFmt,
        title: creName
      }) +
      menuTemplate.titleFmt({
        style: design.atkLabelFmt,
        title: type
      }) +
      "</div>";

    str = str.replace(type, "").trim();
    str = str.replace(/\band\b/g, ",");
    volley = str.split(/\bor\b/g);
    if (volley.length > 1) {
      while (volley.length > 0) {
        if (!volley[0] || !volley[0].match(/[^\s]+/)) {
          volley.shift();
          continue;
        }
        if (alphabet.length <= 0) {
          alphabet.unshift(++cnt); // TODO: this looks like a bug
        }
        attacks = volley[0].split(/,(?![^\(\)]*\))/);
        atkList += addAttacks(attacks, charId, label, specials, alphabet[0]);
        volley.shift();
        alphabet.shift();
      }
    } else {
      attacks = str.split(/,(?![^\(\)]*\))/);
      atkList += addAttacks(attacks, charId, label, specials);
    }

    atkList =
      atkList +
      "</div>" +
      menuTemplate.boundryImg({
        imgLink: design.atkBotImg
      });
    addAbility(label, "", atkList, false, charId);
  };

  /**
   * addAttacks - Adds attacks
   * @param {string[]} aryList - string list of all possible attacks
   * @param {any} charId - the character ID
   * @param {string} label - the label for the type of attack ('ATK', 'RNG', etc.)
   * @param {any} specials - the specials object (name/value where value is string[])
   * @param {string} [volley] - assigned from alphabet, TODO
   * @returns {string} - html with the attack buttons
   */
  var addAttacks = function(aryList, charId, label, specials, volley) {
    if (!aryList || !label || !charId) {
      return undefined;
    }
    var attack,
      atkName,
      atkMod,
      atkRiders,
      atkDamage,
      atkIter,
      critRange,
      atkStr,
      dmgStr,
      abName,
      iterCnt = 0,
      atkList = "",
      atkTitle;

    creLog("addAttacks: " + aryList + " " + label + " " + volley, 1);

    for (var i = 0; i < aryList.length; ++i) {
      if (!aryList[i] || !aryList[i].match(/[^\s]+/)) {
        continue;
      }
      attack = aryList[i].trim();
      atkName = attack.match(/\b[^\d\(\)\+\/×]+(?=\+|\-)/);
      if (!atkName) {
        /* if we don't have an attack name, we either don't have
					a modifier or there's a modifier with no name..*/
        /* if there is no modifier, the name spans from 0,
					to the first paren, absorb the rider into the
					name if any; if there's no paren cough up the error ghost.
					If there is a modifier, then append a default name*/
        if (attack.substring(0, attack.indexOf("(")).match(/\+\-/)) {
          atkName = "Basic " + label + " ";
          attack = atkName + attack;
        } else {
          atkName = attack.substring(0, attack.indexOf("(")).trim();
        }
      } else {
        atkName = attack
          .substring(0, attack.indexOf(atkName[0]) + atkName[0].length)
          .trim();
      }
      // Ensure there's a damage section
      if (attack.match(/\(.+\)/)) {
        atkMod = attack
          .substring(atkName.length, attack.indexOf("(") - 1)
          .trim();
        atkDamage = attack.substring(
          attack.indexOf("(") + 1,
          attack.indexOf(")")
        );
        atkRiders = atkMod.match(/\b[^\d\(\)\+\-\/×]+/);
      } else {
        atkMod = getBonusNumber(attack);
        atkDamage = "0";
      }

      critRange = getCritRange(atkDamage);
      atkDamage = formatDamage(atkDamage, specials);
      creLog("addAttacks: got damage for " + attack, 1);
      // do iteratives:
      atkIter = atkMod.split("/");
      if (atkIter && atkIter.length > 1) {
        while (atkIter.length > 0) {
          ++iterCnt;

          atkTitle = fields.publicName + " attacks with " + atkName + "!";
          atkStr =
            "[[1d20" +
            (critRange.range < 20 ? "cs>" + critRange.range : "") +
            atkIter[0] +
            "]]" +
            (critRange.range < 20 || critRange.multi > 2
              ? " (" +
                ((critRange.range < 20 ? critRange.range + "-20" : "") +
                  (critRange.multi > 2
                    ? (critRange.range < 20 ? "/×" : "×") + critRange.multi
                    : "") +
                  ")")
              : "") +
            (!atkRiders ? "" : " [" + atkRiders[0].trim() + "]");
          abName =
            label +
            (volley ? "[" + volley + "]" : "") +
            "_" +
            atkName +
            "(" +
            iterCnt +
            ")";
          atkStr =
            "!\n" +
            fields.publicAnn +
            applyAtkTemp(fields.tmpAtk, atkTitle, atkStr, atkDamage.damage);
          atkStr =
            atkStr +
            (atkDamage.rider === ""
              ? ""
              : "\n" + fields.resultWhis + atkDamage.rider);
          addAbility(abName, "", atkStr, false, charId);
          atkIter.shift();
          atkList =
            atkList +
            menuTemplate.midButton({
              riders: undefined,
              creName: creName,
              abName: abName,
              btnName: abName
            });
        }
      } else {
        atkTitle = fields.publicName + " attacks with " + atkName + "!";
        atkStr =
          (atkMod !== ""
            ? "[[1d20" +
              (critRange.range < 20 ? "cs>" + critRange.range : "") +
              atkMod +
              "]]"
            : "auto-hit") +
          (critRange.range < 20 || critRange.multi > 2
            ? " (" +
              ((critRange.range < 20 ? critRange.range + "-20" : "") +
                (critRange.multi > 2
                  ? (critRange.range < 20 ? "/×" : "×") + critRange.multi
                  : "") +
                ")")
            : "") +
          (!atkRiders ? "" : " [" + atkRiders[0].trim() + "]");
        abName = label + (volley ? "[" + volley + "]" : "") + "_" + atkName;
        atkStr =
          "!\n" +
          fields.publicAnn +
          applyAtkTemp(fields.tmpAtk, atkTitle, atkStr, atkDamage.damage);
        atkStr =
          atkStr +
          (atkDamage.rider === ""
            ? ""
            : "\n" + fields.resultWhis + atkDamage.rider);

        addAbility(abName, "", atkStr, false, charId);
        atkList =
          atkList +
          menuTemplate.midButton({
            riders: undefined,
            creName: creName,
            abName: abName,
            btnName: abName
          });
      }
      creLog(
        "addAttacks: " +
          attack +
          " atkname: '" +
          atkName +
          "' atkmod: '" +
          atkMod +
          "' atkDam: '" +
          atkDamage +
          "' atkRiders: '" +
          atkRiders +
          "'",
        1
      );
    }
    creLog("addAttacks: finished attacks for " + label, 1);
    return atkList;
  };

  /**
   * getCritRange - Gets the crit range from the damage string.
   * @param {string} str - source to extract the crit range values from
   * @returns {any} - and object with the low number of the crit range and the multiplier
   */
  var getCritRange = function(str) {
    if (!str) {
      return {
        range: 20,
        multi: 2
      };
    }

    var multi = "2";
    var range = "20";
    var tmp;
    var terms = str.split("/");

    if (terms && terms.length > 0) {
      for (var i = 0; i < terms.length; ++i) {
        if (terms[i].match(/×\d+/)) {
          var multiArr = terms[i].match(/\d+/g);
          if (!multiArr) {
            multi = "2";
          } else {
            multi = multiArr[0];
          }
        } else if ((tmp = terms[i].match(/\b\d+\-\d+/))) {
          var rangeArr = tmp[0].match(/\d+/g);
          if (!rangeArr) {
            range = "20";
          } else {
            range = rangeArr[0];
          }
        }
      }
    }

    var retval = {
      range: parseInt(range),
      multi: parseInt(multi)
    };
    return retval;
  };

  /**
   * formatDamage - Format the damage string and attach any riders if any. Be careful about
   * subrider semantics.
   * @param {string} str - the string to parse the attack information our of
   * @param {any} specials - the specials object (name/value where value is string[])
   * @returns {any} - an object with parsed attack damage and rider (attack details) properties.
   */
  var formatDamage = function(str, specials) {
    if (!str) {
      return {
        damage: "",
        rider: ""
      };
    }

    var damage,
      damageStr = "",
      damageExpr,
      damageTypes,
      riders,
      riderStr = "",
      ploc = -1,
      tmp;
    var re = /\d+d\d+/;

    creLog("formatDamage str: " + str, 2);
    damage = re.exec(str);
    ploc = str.indexOf("plus");

    // if flat, or rider only damage section
    if (!damage) {
      if (ploc !== -1) {
        var damageStrArr = str.substring(0, ploc).match(/\b[\d]+\s/);
        if (!damageStrArr) {
          damageStrArr = str.match(/\b[^\d\/\(\)\+×\s]+\b/);
          creLog("damageStr: " + damageStrArr, 3);
          if (!damageStr) {
            // give up if things get too weird
            throw "ERROR: Bad damage format: '" + str + "'";
          }
					str = str.substring(0, ploc + 4) + " " + damageStrArr[0].trim() + "," + str.substring(ploc + 4);
        }
      } else if (!!(damageStrArr = str.match(/\b[^\d\/\(\)\+×\s]+\b/))) {
        str = str + " plus " + damageStrArr[0].trim();
      }
      damageStr = "[[0d0]]";
    } else {
      damageExpr = getExpandedExpr(damage[0], str, damage.index).trim();
      damageStr = getFormattedRoll(damageExpr);
      // handle damage type
      damageTypes = str.match(/\b[^\d\/\(\)\+×]+\b/);
      if (damageTypes) {
        /* In the case where we have a type we need to get rid of the critical
					expression */
        creLog("formatDamage Types: " + damageTypes, 3);
        if (!str.match("plus")) {
          tmp = str.indexOf("/");
					tmp = str.substring(
						str.indexOf(damageExpr) + damageExpr.length,
						tmp === -1 ? str.length : tmp
					).trim();
          damageStr += " " + tmp;
        } else {
          tmp = str.indexOf("/");
					tmp = str.substring(
						str.indexOf(damageExpr) + damageExpr.length,
						tmp === -1 ? ploc : tmp
					).trim();

          damageStr += " " + tmp;
        }
      }
    }

    // handle riders
    if (str.match("plus")) {
      riders = str.substring(str.indexOf("plus"));
      creLog("riders are: " + riders, 3);
      riders = riders.replace("plus", "");
      var ary = riders.split(/,(?![^\(\)]*\))/);
      var riderName;
      var subRiders;
      creLog("ary: " + ary);
      while (ary && ary.length > 0) {
        if (!ary[0] || !ary[0].match(/[^\s]+/)) {
          ary.shift();
          continue;
        }
        riderName = ary[0].match(/\b[^\d\/\(\)\+×]+/);
        // resolve unlabeled/typed damage riders
        if (!riderName) {
          riderName = "untyped";
          ary[0] = riderName + ary[0];
        } else {
          riderName = riderName[0];
        }
        subRiders = ary[0].replace(riderName, "").trim();
        riderName = riderName.toLowerCase().trim();
        creLog("ary val: " + ary[0], 4);
        creLog("subrider: " + subRiders + " riderName: " + riderName, 4);
        creLog("specials: " + specials[riderName], 4);
        if (!specials) {
          riderStr +=
            "<div>" +
            getTermLink(riderName, termEnum.GENERAL) +
            " " +
            (subRiders.match(/[^\s]+/)
              ? " " + getFormattedRoll(subRiders)
              : "") +
            "</div>";
        } else {
          riderStr +=
            "<div>" +
            ((specials[riderName]
              ? getFormattedRoll(getDamageRiderInfo(riderName, specials))
              : undefined) || getTermLink(riderName, termEnum.GENERAL)) +
            " " +
            (subRiders.match(/[^\s]+/)
              ? " " + getFormattedRoll(subRiders, termEnum.GENERAL)
              : "") +
            "</div>";
        }
        ary.shift();
      }
    }
    creLog("formatDamage: " + damageStr + " riders: " + riderStr, 1);
    var retval = {
      damage: damageStr,
      rider: riderStr
    };
    return retval;
  };

  /**
   * getDamageRiderInfo - Gets all damage descriptive information
   * @param {string} riderName - the name of the special property for the description
   * @param {any} specials - the parsed specials object
   * @returns {string} - html formatted with paragraphs
   */
  var getDamageRiderInfo = function(riderName, specials) {
    var retval = "";
    var riderInfo;
    var re;
    if (specials) {
      riderInfo = specials[riderName];
      creLog("RiderInfo: " + riderInfo, 3);
      if (riderInfo) {
        while (riderInfo.length > 0) {
          re = new RegExp("\\b" + riderName + "\\b", "ig");
          riderInfo[0] = riderInfo[0].replace(
            re,
            getTermLink(riderName, termEnum.GENERAL) + " "
          );
          retval += "<p>" + riderInfo[0] + "</p>";
          creLog("RiderInfoLine: " + retval, 3);
          riderInfo.shift();
        }
      }
    }
    return retval;
  };

  /**
   * formatAttribute - Format an attribute by the type desired:
   * 0 - scalar, grab the first number
   * 1 - pos/neg, grab the first number as well as the sign if any - never used
   * @param {string} name
   * @param {string | number} type
   * @param {number} charId - the character ID
   */
  var formatAttribute = function(name, type, charId) {
    if (!name || !charId) {
      return;
    }
    if (!type) {
      type = 0;
    }
    var retval = "0";
    var attr;

    attr = getAttribute(name, charId);

    if (!attr) {
      throw "Error: no attribute found '" + name + "'";
    }
    retval = attr.get("current");

    switch (type) {
      case 0:
        retval = retval.match(/\d+/g)[0];
        break;
      case 1:
        retval = getBonusNumber(retval);
        break;
    }

    creLog(
      "formatAttribute: " +
        retval +
        " n: " +
        name +
        " t: " +
        type +
        " c: " +
        charId,
      2
    );

    attr.set("current", retval);
    attr.set("max", retval);
  };

  /**
   * applyAtkTemp - Apply attack template
	 * @param {string} template - the attack tamplate
	 * @param {string} titleStr - the title for the attack
	 * @param {string} atkStr - roll20 attack dice roll, lots of features in it
	 * @param {string} dmgStr - roll20 damage dice roll
	 */
  var applyAtkTemp = function(template, titleStr, atkStr, dmgStr) {
    if (!template || !titleStr || !atkStr || !dmgStr) {
      return undefined;
    }
    creLog(
      "title: " + titleStr + " atk " + atkStr + " dmg " + dmgStr + template,
      2
    );
    var retval;
    if (!template.match(atkEnum.ATTACK) || !template.match(atkEnum.DAMAGE)) {
      log("attack template is malformed");
      return retval;
    }
    retval = template.replace("<<" + atkEnum.TITLE + ">>", titleStr);
    retval = retval.replace("<<" + atkEnum.ATTACK + ">>", atkStr);
    retval = retval.replace("<<" + atkEnum.DAMAGE + ">>", dmgStr);
    return retval;
  };

  /**
   * addAttribute - Add an attribute to a character
	 * @param {string} name - the attribute's name
	 * @param {string } curVal - the max value
	 * @param {string } maxVal - the current value
	 * @param {string} charId - character ID for the attribute
	 */
   var addAttribute = function(name, curVal, maxVal, charId) {
    if (!curVal) {
      curVal = "";
    }
    if (!maxVal) {
      maxVal = "";
    }
		 creLog(
			 "addAttribute: " + fields.charDataPrefix + name + " " + curVal + " " + maxVal + " " + charId, 2);

    createObj("attribute", {
      name: fields.charDataPrefix + name,
      current: curVal,
      max: maxVal,
      characterid: charId
    });
  };

  /**
   * getAttribute - Get an attribute from a character, adds CGen_ prefix to the attribute name
	 * @param {string} name - the name of the attribute to find
	 * @param {number} charId - character ID for the attribute
	 */
  var getAttribute = function(name, charId) {
    var obj = findObjs({
      _type: "attribute",
      name: fields.charDataPrefix + name,
      _characterid: charId
		});
		
		if (!obj) {
			return undefined;
		}
		return obj[0];
  };

  /**
   * addAbility - Add an ability to a character
	 * @param {string} name
	 * @param {string} desc - never used
	 * @param {string} action
	 * @param {boolean} isTokenAct
	 * @param {number} charId
	 */
	var addAbility = function (name, desc, action, isTokenAct, charId) {
		// TODO: this almost adds nothing over straight call to createObj
		createObj("ability", {
			name: name,
			description: desc,
			action: action,
			istokenaction: isTokenAct,
			characterid: charId
		});
	};

  /**
   * addAttributeRoll - Add an ability roll from an attribute
	 * @param {string} name - ability name
	 * @param {string} attrName - attribute for roll
	 * @param {boolean} isPublic - if true, display '/desc', or '/w GM' if false
	 * @param {boolean} isTokenAction
	 * @param {number} charId
	 * @param {string} rider - never used?
	 */
	var addAttributeRoll = function (name, attrName, isPublic, isTokenAction, charId, rider) {
		if (!name || !attrName || typeof charId === undefined) {
			return;
		}
		if (!isPublic) {
			isPublic = false;
		}
		var action = "";
		var attr = getAttribute(attrName, charId);
    if (!attr) {
			throw "Error: no attribute found '" + attrName + "'";
		}
		action = "!\n" + (isPublic ? fields.publicAnn : fields.resultWhis) + creName + ": " + attrName +
			": [[ 1d20" + getBonusNumber(attr.get("current")) + (rider ? " " + rider : "") + "]]";
    
    addAbility(name, "", action, isTokenAction, charId);
	};

  /**
   * addAttrList - Given a line containing the most attributes, add them to the character
	 * @param {string[]} data - The cleaned data from the gm notes field of the token
	 * @param {string} line - the line to get the attributes from
	 * @param {string[]} aryList - array of attributes to try to find
	 * @param {string | number} startFnd - if unable to get attribute from line, then the offset in data to start at
	 * @param {string[]} termChars - array of possible attribute termination characters
	 * @param {string} charId - the character ID to add the attribute(s) to.
	 */
  var addAttrList = function(data, line, aryList, startFnd, termChars, charId) {
    if (!aryList || !termChars || !charId) {
      return;
    }
    if (!line) {
      line = data[0];
    }
    if (!startFnd) {
      startFnd = 0;
    }
    var rc;

		creLog("addAttrList: " + startFnd + " " + termChars + " " + charId + " " + line + " " + !!aryList, 3);
    while (aryList.length > 0) {
      rc = getValueByName(aryList[0], line, termChars);
      if (!rc) {
        var nextBestLine = getLineByName(aryList[0], data, startFnd);
        rc = getValueByName(aryList[0], nextBestLine, termChars);
        if (!rc) {
          throw "ERROR: could not find attribute " + aryList[0];
        }
      }
      addAttribute(aryList[0], rc, rc, charId);
      aryList.shift();
    }
  };

  /**
   * getTermLink - Return a URL link formatted by type, typically a google search, etc.
	 * @param {string} str - typically, a search term
	 * @param {number} type - value to select what base URL template to use
	 * @param {string} [label] - label for the formatter URL link <a> tag
	 * @returns {string} - the formatted <a> tag
	 */
	var getTermLink = function (str, type, label) {
		if (!str || !type) {
			return undefined;
		}
		if (!label) {
			label = str;
		}
		var retval = str;
		switch (type) {
			case termEnum.GENERAL:
				retval = getFormattedUrl(str, fields.urlTermGeneral, label);
				break;
			case termEnum.SPELL:
				retval = getFormattedUrl(str, fields.urlTermSpell, label);
				break;
			case termEnum.FEAT:
				retval = getFormattedUrl(str, fields.urlTermFeat, label);
				break;
			case termEnum.SQ:
				retval = getFormattedUrl(str, fields.urlTermSQ, label);
				break;
			case termEnum.SA:
				retval = getFormattedUrl(str, fields.urlTermSA, label);
				break;
			default:
				retval = str;
		}
		creLog("getTermLink: " + retval, 3);
		return retval;
	};

  /**
   * Return a formatted URL by filling in placeholders. with str and label
	 * @param {string} str - typically, a search term
	 * @param {string} url - url template to format
	 * @param {string} [label] - label for the formatter URL link <a> tag
	 * @returns {string} - the formatted <a> tag
	 */
 var getFormattedUrl = function(str, url, label) {
    if (!str || !url) {
      return undefined;
    }
    if (!label) {
      label = str;
    }
    var retval;
    var re = /<<\w+>>/g;
	 var matches, cond;
	 var condArr;

    creLog("formatting str: '" + str + "' on url: '" + url + "'", 4);
    if ((matches = url.match(re))) {
      while (matches.length > 0) {
        creLog("formaturl: " + matches[0], 5);
        matches[0] = matches[0].replace(/<<|>>/g, "");
        if ((condArr = matches[0].match(/\D+/))) {
          creLog("formaturl word: " + condArr[0], 5);
          switch (condArr[0]) {
            case urlCondEnum.FULL:
              url = url.replace("<<" + urlCondEnum.FULL + ">>", str);
              break;
            case urlCondEnum.LABEL:
              url = url.replace("<<" + urlCondEnum.LABEL + ">>", label);
              break;
            default:
              creLog("unsupported url subsitution: " + matches[0], 1);
          }
        } else if ((condArr = matches[0].match(/\d+/))) {
          cond = parseInt(condArr[0]);
          creLog("formaturl char: " + cond, 5);
          if (cond < str.length) {
            url = url.replace("<<" + matches[0] + ">>", str[cond]);
          } else {
            creLog("illegal string index of " + cond + " in '" + str + "'", 1);
          }
        }
        matches.shift();
      }
    }
    retval = url;
    creLog("formattedUrl: " + retval, 4);
    return retval;
  };

  /**
   * getBonusNumber - Get the bonus number in the string, carefully looking for signs to
   * preserve negatives and what not. TODO there's a Regex solution to this
   * which is way shorter.. also add type for scalars.
 	 * @param {string} str - string to get the bonus info from
	 * @param {number} [type] - one of bonusEnum
	 * @returns {string} - bonus number or math expression 
	 */
 var getBonusNumber = function(str, type) {
    if (!str) {
      return "0";
    }
    if (!type) {
      type = bonusEnum.SIGN;
    }
    var retval = "0";
    var locStart = 0;
    var locEnd = str.length;
    var num;

    str = str.replace(/\s/g, "");
    switch (type) {
      case bonusEnum.SCALAR:
        num = str.match(/\d+/);
        if (num) {
          retval = num[0];
        } else {
          retval = "0";
        }
        break;
      case bonusEnum.SIGN:
        num = str.match(/\+*\-*\d+/);
        if (num) {
          if (!num[0].match(/\+|\-/)) {
            retval = "+" + num[0];
          } else {
            retval = num[0];
          }
        } else {
          retval = "+0";
        }
        break;
      default:
        // impossible
        return undefined;
    }
    return retval;
  };

  /**
   * getFormattedRoll - Return the string with the roll formatted, this is accomplished by simply
   * surrounding roll equations with [[ ]] TODO, should be replaced with a single regex
	 * @remarks this method is recursive, looking for all of the rols in a str
   * @param {string} str - string to search for roll for find something like 2d20
   */
  var getFormattedRoll = function(str) {
    if (!str) {
      return "";
    }

    var re = /\d+d\d+/;
    var idx, expr, roll, pre, post;

    if (!!(roll = re.exec(str))) {	// TODO: double ! - possible error?
      expr = getExpandedExpr(roll[0], str, roll.index);
      idx = str.indexOf(expr);
      pre = str.substring(0, idx);
			post = str.substring(idx + expr.length);			
			
			return pre + "[[" + expr + "]]" + getFormattedRoll(post);
    } else {
      return str;
    }
  };

  /**
   * Return the target expression expanded as far as it logically can span
   * within the provided line.
   *
   * ie: target = 1d20
   *	   locHint = 4
   *	   line = "2+1d20+5+2d4 bla (bla 1d20+8 bla) bla (4d8...) bla bla"
   *
   * result = 2+1d20+5+2d4
	 * @param {string} target - n+dn+ result
	 * @param {string} line - string to search for roll for find rest of roll expression
	 * @param {number} locHint - index where target was found in line
	 */
	var getExpandedExpr = function (target, line, locHint) {
		if (!target || !line) {
			return undefined;
		}
		if (!locHint) {
			locHint = 0;
		}
		var retval = target;
		var re = /\d|[\+\-]|d/;
		var loc = -1,
			start = 0,
			end = 0;

		if ((loc = line.indexOf(target, locHint)) !== -1) {
			start = loc;
			while (start > 0) {
				if (line[start].match(re)) {
					start--;
				} else {
					start++;
					break;
				}
			}
			end = loc;
			while (end < line.length) {
				if (line[end].match(re)) {
					end++;
				} else {
					break;
				}
			}
			retval = line.substring(start, end);
			creLog("getExpandedExpr: '" + retval + "' s: " + start + " e: " + end + " t: " + target + " l: " + line, 4);
			retval = getLegalRollExpr(retval);
		}

		return retval;
	};

  /**
   * getLegalRollExpr - Gets a legal roll expression.
	 * @param {string} expr - string to search for full roll from
	 * @returns {string} the cleaned roll20 roll expression
	 */
	var getLegalRollExpr = function (expr) {

		// TODO strip trailing operands +1d6 and such
	 
		if (!expr) {
			return undefined;
		}
		var retval = expr;
		var stray = expr.match(/d/g);
		var valid = expr.match(/\d+d\d+/g);
		var errMsg = "Illegal expression " + expr;

		try {
			if (
				expr.match(/[^\s\d\+-d]/g) ||
				!stray || !valid ||
				(stray.length !== valid.length)) {
				throw errMsg;
			}
			stray = expr.match(/\+/g);
			valid = expr.match(/\d+\+\d+/g);
			if (stray && valid && stray.length !== valid.length) {
				throw errMsg;
			}
			stray = expr.match(/-/g);
			valid = expr.match(/\d+-\d+/g);
			if (stray && valid && stray.length !== valid.length) {
				throw errMsg;
			}
		} catch (e) {
			creLog(e, 1);
			throw e;
		}

		//check for leading, trailing, operands
		if (retval[0].match(/\+|\-/)) {
			retval = retval.substring(1);
		}
		if (retval[retval.length - 1].match(/\+|\-/)) {
			retval = retval.substring(0, retval.length - 1);
		}

		creLog("getLegalRollExpr: " + retval, 4);
		return retval;
	};

	var t = '📗';

  /**
   * getLineByName - Given a name, array of lines, and a start/end location, find the first
   * line that contains the given name.
   * @param {string} strName - the name to find
   * @param {string[]} cleanedLines - The cleaned data from the gm notes field of the token (data)
   * @param {number} [locStart] - starting line to search
   * @param {number} [locEnd] - end line to search
   * @returns {string} - the matching line, undefined if not found
   */
  var getLineByName = function (strName, cleanedLines, locStart, locEnd) {
    creLog("getLineByName: name " + strName + " data " + !!cleanedLines, 5);
    if (!strName || !cleanedLines) {
      return undefined;
    }
    if (!locStart) {
      locStart = 0;
    }
    if (!locEnd) {
      locEnd = cleanedLines.length;
    }
    var retval;

    creLog("getLineByName: " + strName + " " + locStart + " " + locEnd + " " + !!cleanedLines, 5);

    for (var i = locStart; i < locEnd; ++i) {
      if (cleanedLines[i].indexOf(strName) !== -1) {
        retval = cleanedLines[i];
        break;
      }
    }

    creLog("getLineByName: name " + strName + " value '" + retval, 5);
    return retval;
  };

  /**
   * Given a name, array of lines, and a start/end location, find the first
   * line # that contains the given name.
   * @param {string} strName - the name to find
   * @param {string[]} cleanedLines - The cleaned data from the gm notes field of the token (data)
   * @param {number} [locStart] - starting line to search
   * @param {number} [locEnd] - end line to search
   * @returns {number} - the matching line number, undefined if not found
   */
  var getLineNumberByName =  function(strName, cleanedLines, locStart, locEnd) {
    if (!strName || !cleanedLines) {
      return undefined;
    }
    if (!locStart) {
      locStart = 0;
    }
    if (!locEnd) {
      locEnd = cleanedLines.length;
    }
    var retval;

    creLog("getLineNumberByName: " + strName + " " + locStart + " " + locEnd + " " + !!cleanedLines, 5);
    for (var i = locStart; i < locEnd; ++i) {
      if (cleanedLines[i].indexOf(strName) !== -1) {
        retval = i;
        break;
      }
    }
    return retval;
  };

  /**
   * Given a line, name, and terminators return the value, value is
   * the the trimed text after the name and before the terminator.
   * @param {string} strName - the name to find
   * @param {string} strLine - the line to search
   * @param {string[]} termChars - terminating characters (must exist)
   * @returns {string|undefined} - the portion of strLine between strName and termChars, if found
   */
 var getValueByName = function(strName, strLine, termChars) {
    if (!strLine || !strName || !termChars) {
      return undefined;
    }
    var retval;
    var loc = -1;
    var locTerm = strLine.length;

    creLog("getValueByName: " + strName + " " + termChars + " " + strLine, 5);
    if ((loc = strLine.indexOf(strName)) !== -1) {
      for (var i = 0; i < termChars.length; ++i) {
        var tmp = strLine.indexOf(termChars[i], loc);
        if (tmp !== -1 && tmp < locTerm) {
          locTerm = tmp;
        }
      }
      if (locTerm > loc) {
        locTerm = getParenSafeTerm(strLine, loc, locTerm, termChars);
        retval = strLine.substring(loc + strName.length, locTerm);
      }
    }
    return retval;
  };

  /**
   * getParenSafeTerm - Get the location of the closest terminator that is paren safe. If there
   * are parens. Probably a faster way exists using regex and exec..
   * @param {string} strLine - the line to search
   * @param {number} start
   * @param {number} end
   * @param {string[]} termChars - terminating characters (must exist)
   * @returns {number} - some weird calculation of the end
   */
  var getParenSafeTerm = function (strLine, start, end, termChars) {
    var newTerm = -1;
    var inParen = 0;
    var closeLoc = -1;
    var i;

    if (start >= end) {
      return end;
    }
    for (i = start; i < strLine.length; ++i) {
      if (strLine[i] === "(") {
        inParen++;
      } else if (strLine[i] === ")") {
        inParen--;
      }
      if (i >= end) {
        if (inParen <= 0) {
          return end;
        } else if (inParen > 0) {
          break;
        }
      }
    }
    if (inParen <= 0) {
      return end;
    }

    // if we found we're in parens
    creLog("in parens for " + strLine + " openparens: " + inParen, 5);
    closeLoc = strLine.indexOf(")", start);
    end = strLine.length;
    if (closeLoc === -1) {
      return end;
    }
    for (i = 0; i < termChars.length; ++i) {
      if (-1 === (newTerm = strLine.indexOf(termChars[i], closeLoc))) {
        newTerm = strLine.length;
      } else if (newTerm < end) {
        end = newTerm;
      }
    }
    return end;
  };

  /**
   * characterObjExists - check if the character object exists, return first match
   * @param {string} name - the name of the Rool 20 object
   * @param {string} type - a Roll 20 type (here it is always 'ability')
   * @param {string} charId - the character ID
   */
  var characterObjExists = function(name, type, charId) {
    var retval;
    var obj = findObjs({
      _type: type,
      name: name,
      _characterid: charId
    });
    creLog("type: " + type + " name: " + name + " charId: " + charId + " retval: " + obj, 5);
    if (obj.length > 0) {
      retval = obj[0];
    }
    return retval;
  };

  // /** removes all occurence of removeStr in str and replaces them with replaceWidth
  //  */
  // var stripString = function(str, removeStr, replaceWith) {
  //   while (str.indexOf(removeStr) !== -1) {
  //     str = str.replace(removeStr, replaceWith);
  //   }
  //   return str;
  // };

  String.prototype.replaceAll = function (search, replacement) {
    var target = this;
    return target.split(search).join(replacement);
  };

  /**
   * cleanString - Cleans the string preserving select special characters and dropping the remainder.
   * @param {string} strSpecials - the string to clean
   */
  var cleanString = function (strSpecials) {
    strSpecials = strSpecials.replaceAll("%20", " ");
    strSpecials = strSpecials.replaceAll("%22", '"');
    strSpecials = strSpecials.replaceAll("%29", ")");
    strSpecials = strSpecials.replaceAll("%28", "(");
    strSpecials = strSpecials.replaceAll("%2C", ",");
    strSpecials = strSpecials.replaceAll("%42", "");
    strSpecials = strSpecials.replaceAll("*", "");
    strSpecials = strSpecials.replaceAll("\n", "");
    strSpecials = strSpecials.replaceAll("%3Cbr", "");

    strSpecials = strSpecials.replaceAll("%09", "	");
    strSpecials = strSpecials.replaceAll("%3C", "<");
    strSpecials = strSpecials.replaceAll("%3E", ">");
    strSpecials = strSpecials.replaceAll("%23", "#");
    strSpecials = strSpecials.replaceAll("%3A", ":");
    strSpecials = strSpecials.replaceAll("%3B", ";");
    strSpecials = strSpecials.replaceAll("%3D", "=");
    strSpecials = strSpecials.replaceAll("%D7", "×");
    strSpecials = strSpecials.replaceAll("%u2018", "");
    strSpecials = strSpecials.replaceAll("%u2019", "");
    strSpecials = strSpecials.replaceAll("%u2013", "-");
    strSpecials = strSpecials.replaceAll("%u2014", "—");
    strSpecials = strSpecials.replaceAll("%u201C", "“");
    strSpecials = strSpecials.replaceAll("%u201D", "”");

    while (strSpecials.search(/%../) !== -1) {
      strSpecials = strSpecials.replace(/%../, "");
    }

    strSpecials = strSpecials.replace(/<[^<>]+>|<\/[^<>]+>/g, "");

    return strSpecials;
  };

  /**
   * creLog - Logging, store it
   * @param {string} msg the message to log
   * @param {number} [lvl] - ther level to log at (default is 1)
   */
  var creLog = function(msg, lvl) {
    if (msg) {
      if (!lvl) {
        lvl = 1;
      }
      if (dmesg) {
        dmesg.push("[" + lvl + "]:" + " " + msg);
      } else {
        dmesg = new Array("[" + lvl + "]:" + " " + msg);
      }
    }
  };

  /**
   * creLogDump - dumps the log to the Roll20 log
   * @param {number} [lvl] - the level to send to roll 20's log
   */
  var creLogDump = function(lvl) {
    if (dmesg) {
      log("--- Dumping log at level [" + lvl + "] ---");
      _.every(dmesg, function(line) {
        var clvl = line.match(/\d+/);
        if (clvl && parseInt(clvl[0].trim()) <= lvl) {
          log(line);
        }
        return true;
      });
      log("--- Log dump at level [" + lvl + "] complete ---");
    } else {
      log("No log found");
    }
  };

  /**
   * Add warnings - store them
   * @param {string} msg the message to log
   */
  var creLogWarning = function(msg) {
    if (warn) {
      warn.push(msg);
    } else {
      warn = new Array(msg);
    }
  };

  /**
   * sendWarnings - Send warnings
   */
  var sendWarnings = function(token, msg) {
    var content = "";
    if (warn) {
      _.every(warn, function(elem) {
        content +=
          "<p>" +
          '<span style="color: #FF9100; font-weight: bold">Warning: </span>' +
          elem +
          "</p>";
        return true;
      });
      content += msg ? msg : "";
      sendFeedback(content, design.warningImg, token.get("imgsrc"));
    }
  };

  /**
   * getWarningBlock - get warning block
   * @param {string} msg  - the message to build an html block for
   * @returns {string} the formatted html for the message.
   */
  var getWarningBlock = function(msg) {
    var content = "";
    if (warn) {
      _.every(warn, function(elem) {
        content +=
          "<p>" +
          '<span style="color: #FF9100; font-weight: bold">Warning: </span>' +
          elem +
          "</p>";
        return true;
      });
      content += msg ? msg : "";
      return content;
    }
  };

  /**
   * sendFeedback - posts a message to the chat (whisper to GM).
   * @param {string} msg - the message to post
   * @param {string} [img]
   * @param {string} [tokenImg]
   */
  var sendFeedback = function (msg, img, tokenImg) {
    var content =
      "/w GM " +
      '<div style="position: absolute; top: 4px; left: 5px; width: 26px;">' +
      '<img src="' +
      design.feedbackImg +
      '">' +
      "</div>" +
      msg;
    if (tokenImg && img) {
      content =
        content +
        '<div style="position: relative">' +
        '<div style="position: relative; width: 70px; height: 70px; overflow: hidden;">' +
        '<img src="' +
        tokenImg +
        '" style="position: relative; width: 70px; height: 70px;">' +
        "</div>" +
        '<div style="position: absolute; top: 0px; width: 70px; height: 70px;">' +
        '<img src="' +
        img +
        '" style="position: relative;">' +
        "</div>" +
        "</div>";
    }

    sendChat(design.feedbackName, content);
  };

  // /**
  //  * Fake message block
  //  */
  // var getFeedbackBlock = function(msg, img, tokenImg) {
  //   var content = msg;
  //   if (tokenImg && img) {
  //     content +=
  //       "<div>" +
  //       '<div style="display: inline-block; position: relative; width: 70px; height: 70px; overflow: hidden;">' +
  //       '<img src="' +
  //       tokenImg +
  //       '" style="position: relative; width: 70px; height: 70px;">' +
  //       "</div>" +
  //       '<div style="display: inline-block; position: absolute; left: 45px; width: 70px; height: 70px; overflow: hidden;">' +
  //       '<img src="' +
  //       img +
  //       '" style="position: relative;">' +
  //       "</div>" +
  //       "</div>";
  //   }
  //   return content;
  // };

  /**
   * Performs Genesis with a default name other than 'Creature''
   */
  var doNameGenesis = function(msg, name) {
    if (!msg || !name) {
      return undefined;
    }
    var originalDefaultName = fields.defaultName;

    fields.defaultName = name;
    doGenesis(msg);
    fields.defaultName = originalDefaultName;
  };

  /**
   * Performs Genesis granting control to a player
   */
  var doPlayerGenesis = function(msg, playerName) {
    if (!msg || !playerName) {
      return undefined;
    }
    var players;
    var name;
    var targets = [];
    var targetName;
    var targetPlayer;
    var levDiff = 0;
    var minDiff = 255; // good enough
    var originalMenuWhis = fields.menuWhis;
    var originalResultWhis = fields.resultWhis;
    var originalName = fields.publicName;
    var originalPublicAnn = fields.publicAnn;
    var re = new RegExp(playerName, "i");
    players = findObjs({
      _type: "player"
    });

    _.every(players, function(elem) {
      name = elem.get("_displayname").toLowerCase();
      if (name.match(re)) {
        targets.push(elem);
      }
      return true;
    });

    if (targets.length < 1) {
      sendFeedback("Could not find player: " + playerName);
      return undefined;
    } else if (targets.length === 1) {
      targetName = targets[0].get("_displayname").toLowerCase();
      targetPlayer = targets[0];
    } else {
      targetName = targets[0].get("_displayname").toLowerCase();
      _.every(targets, function(elem) {
        name = elem.get("_displayname").toLowerCase();
        levDiff = getLev(playerName, name);
        if (levDiff < minDiff) {
          minDiff = levDiff;
          targetName = name;
          targetPlayer = elem;
        }
        return true;
      });
    }
    fields.menuWhis = '/w "' + targetName + '" ';
    fields.resultWhis = "";
    fields.publicAnn = "";
    fields.summoner = targetPlayer;
    doGenesis(msg);
    var pgenWork = function(args) {
      fields.summoner = undefined;
      fields.publicAnn = originalPublicAnn;
      fields.publicName = originalName;
      fields.resultWhis = originalResultWhis;
      fields.menuWhis = originalMenuWhis;
    };
    workList.push({
      workFunc: pgenWork
    });
  };

  var getLev = function(s1, s2, cost_ins, cost_rep, cost_del) {
    //		 discuss at: http://phpjs.org/functions/levenshtein/
    //		original by: Carlos R. L. Rodrigues (http://www.jsfromhell.com)
    //		bugfixed by: Onno Marsman
    //		 revised by: Andrea Giammarchi (http://webreflection.blogspot.com)
    // reimplemented by: Brett Zamir (http://brett-zamir.me)
    // reimplemented by: Alexander M Beedie
    // reimplemented by: Rafał Kukawski
    //		  example 1: levenshtein('Kevin van Zonneveld', 'Kevin van Sommeveld');
    //		  returns 1: 3
    //		  example 2: levenshtein("carrrot", "carrots");
    //		  returns 2: 2
    //		  example 3: levenshtein("carrrot", "carrots", 2, 3, 4);
    //		  returns 3: 6
    var LEVENSHTEIN_MAX_LENGTH = 255; // PHP limits the function to max 255 character-long strings

    cost_ins = cost_ins === undefined ? 1 : +cost_ins;
    cost_rep = cost_rep === undefined ? 1 : +cost_rep;
    cost_del = cost_del === undefined ? 1 : +cost_del;

    if (s1 === s2) {
      return 0;
    }

    var l1 = s1.length;
    var l2 = s2.length;

    if (l1 === 0) {
      return l2 * cost_ins;
    }
    if (l2 === 0) {
      return l1 * cost_del;
    }

    // Enable the 3 lines below to set the same limits on string length as PHP does
    /*if (l1 > LEVENSHTEIN_MAX_LENGTH || l2 > LEVENSHTEIN_MAX_LENGTH) {
			return -1;
		}*/

    // BEGIN STATIC
    var split = false;
    try {
      split = !"0"[0];
    } catch (e) {
      // Earlier IE may not support access by string index
      split = true;
    }
    // END STATIC
    if (split) {
      s1 = s1.split("");
      s2 = s2.split("");
    }

    var p1 = new Array(l2 + 1);
    var p2 = new Array(l2 + 1);

    var i1, i2, c0, c1, c2, tmp;

    for (i2 = 0; i2 <= l2; i2++) {
      p1[i2] = i2 * cost_ins;
    }

    for (i1 = 0; i1 < l1; i1++) {
      p2[0] = p1[0] + cost_del;

      for (i2 = 0; i2 < l2; i2++) {
        c0 = p1[i2] + (s1[i1] === s2[i2] ? 0 : cost_rep);
        c1 = p1[i2 + 1] + cost_del;

        if (c1 < c0) {
          c0 = c1;
        }

        c2 = p2[i2] + cost_ins;

        if (c2 < c0) {
          c0 = c2;
        }

        p2[i2 + 1] = c0;
      }

      tmp = p1;
      p1 = p2;
      p2 = tmp;
    }

    c0 = p1[l2];

    return c0;
  };

  /**
   * "And then the GM said, let there be monsters!"
   *
   * Performs Creature Generation
   */
  var doGenesis = function(msg) {
    var token;
    var content = "";

    if (!(msg.selected && msg.selected.length > 0)) {
      sendFeedback("no token selected for creature creation");
      return;
    }

    if (msg.selected.length > 1) {
      sendFeedback(
        '<div style="font-weight: bold; color: #7AB6FF; font-size: 150%">' +
          "Starting group generation</div>"
      );
    }
    locked = true;
    workStart = Date.now();

    _.each(
      msg.selected,
      function(e) {
        var genesisWork = function(e) {
          token = getObj("graphic", e._id);
          if ((token && token.get("_subtype") !== "token") || !token) {
            sendFeedback(
              '<span style="font-weight: bold; color: #FF0000;">Invalid Selection</span>' +
                (msg.selected.length > 1
                  ? '<div style="color: black; font-style: italic; font-weight: bold;">(' +
                    (msg.selected.length - workList.length + 1) +
                    "/" +
                    msg.selected.length +
                    ")</div>"
                  : "")
            );
            return;
          }
          try {
            dmesg = undefined;
            warn = undefined;
            scan(token);
            sendFeedback(
              (warn ? getWarningBlock() : "") +
                '<span style="font-weight: bold; color: ' +
                (warn ? "#FF9100" : "#08AF12") +
                ';">' +
                token.get("name") +
                "</span>" +
                " has been generated " +
                (warn ? "with warnings." : "successfully!") +
                (msg.selected.length > 1
                  ? '<div style="color: black; font-style: italic; font-weight: bold;">(' +
                    (msg.selected.length - workList.length + 1) +
                    "/" +
                    msg.selected.length +
                    ")</div>"
                  : ""),
              warn ? design.warningImg : design.successImg,
              token.get("imgsrc")
            );

            character = undefined;

            //creLogDump(5);

          } catch (err) {
            log("GENESIS ERROR: " + err);
            sendFeedback(
              (warn ? getWarningBlock() : "") +
                '<span style="font-weight: bold; color: #FF0000;">' +
                "There was an error during token generation." +
                "</span> " +
                "Please see the log for details, and delete the erroneous journal entry." +
                (msg.selected.length > 1
                  ? '<div style="color: black; font-style: italic; font-weight: bold;">(' +
                    (msg.selected.length - workList.length + 1) +
                    "/" +
                    msg.selected.length +
                    ")</div>"
                  : ""),
              design.errorImg,
              token.get("imgsrc")
            );
            creLogDump(debugLvl);
            warn = undefined;
            character = undefined;
            log(
              "-----Please ensure that the statistics block is properly formatted.-----"
            );
          }
        };

        workList.push({
          workFunc: genesisWork,
          workData: [e]
        });
      },
      this
    );

    if (msg.selected.length > 1) {
      workList.push({
        workFunc: function() {
          var tTime = (Date.now() - workStart) / 1000;
          sendFeedback(
            '<div style="font-weight: bold; color: #08AF12; font-size: 150%">' +
              "Group generation complete </div>" +
              '<div style="color: blue; font-size: 100%; font-style: italic: font-weight: bold">(Time elapsed: ' +
              tTime.toFixed(2) +
              "s)</div>"
          );
          locked = false;
        },
        workData: []
      });
    } else {
      locked = false;
    }

    doDelayedWork(workList);
  };

  /**
   * Delayed Worktask
   */
  var doDelayedWork = function() {
    if (!workList || !workList.length) {
      return;
    }

    var payload = workList.shift();
    if (!payload) {
      return;
    }
    payload.workFunc.apply(undefined, payload.workData);
    setTimeout(doDelayedWork, workDelay);
  };

  /**
   * Show help
   */
  var showHelp = function() {
    var content;
    var designTmpList = "";
    var attackTmpList = "";

    if (typeof CGTmp !== "undefined") {
      try {
        _.every(_.keys(CGTmp.designTmp), function(tmp) {
          designTmpList +=
            "<div>" +
            '<a href="!CreatureGen -set-design ' +
            tmp +
            '">' +
            tmp +
            " </a></div>";
          return true;
        });
        _.every(_.keys(CGTmp.attackTmp), function(tmp) {
          attackTmpList +=
            "<div>" +
            '<a href="!CreatureGen -set-attack ' +
            tmp +
            '">' +
            tmp +
            " </a></div>";
          return true;
        });
      } catch (ex) {
        log("ERROR accessing CGTmp: " + e);
        designTmpList = "";
        attackTmpList = "";
      }
    }
    content =
      '<div style="background-color: #FFFFFF; border: 1px solid black; left-margin 5x; right margin 5px; padding-top: 5px; padding-bottom: 5px;;">' +
      '<div style="border-bottom: 1px solid black;">' +
      '<span style="font-weight: bold; font-size: 150%">CreatureGen v' +
      version +
      "</span>" +
      "</div>" +
      '<div style="padding-left: 10px; padding-right: 10px;">' +
      "<div>" +
      '<span style="font-weight: bold;">!CreatureGen -help</span>' +
      "</div>" +
      '<li style="padding-left: 10px;">' +
      "Display this message" +
      "</li>" +
      "<div>" +
      '<span style="font-weight: bold;">!CreatureGen</span>' +
      "</div>" +
      '<li style="padding-left: 10px;">' +
      "Generate creature" +
      "</li>" +
      "<div>" +
      '<span style="font-weight: bold;">!CreatureGen -name [name]</span>' +
      "</div>" +
      '<li style="padding-left: 10px;">' +
      "Generate creature with the given default name" +
      "</li>" +
      "<div>" +
      '<span style="font-weight: bold;">!CreatureGen -player [name]</span>' +
      "</div>" +
      '<li style="padding-left: 10px;">' +
      "Generate player controlled creature (a summon)" +
      "</li>" +
      "<div>" +
      '<span style="font-weight: bold;">!CreatureGen -set-design [name]</span>' +
      "</div>" +
      '<div style="float: right; margin-left 2px; padding-top: 2px; padding-bottom: 2px; padding-left: 2px; padding-right: 2px; border: 1px solid black; background-color: #89FEBA; text-align: center; font-weight: bold;">' +
      (state.cgen_design ? state.cgen_design : "Default") +
      "</div>" +
      '<li style="padding-left: 10px;">' +
      "Set design template" +
      "</li>" +
      (designTmpList === ""
        ? ""
        : '<div style="border: 1px solid blue; text-align: center;"><span style="text-decoration: underline;">Available design templates:</span>') +
      designTmpList +
      (designTmpList === "" ? "" : "</div>") +
      "<div>" +
      '<span style="font-weight: bold;">!CreatureGen -set-attack [name]</span>' +
      "</div>" +
      '<div style="float: right; margin-left 2px; padding-top: 2px; padding-bottom: 2px; padding-left: 2px; padding-right: 2px; border: 1px solid black; background-color: #89FEBA; text-align: center; font-weight: bold;">' +
      (state.cgen_attack ? state.cgen_attack : "Default") +
      "</div>" +
      '<li style="padding-left: 10px;">' +
      "Set attack template" +
      "</li>" +
      (attackTmpList === ""
        ? ""
        : '<div style="border: 1px solid blue; text-align: center;"><span style="text-decoration: underline;">Available attack templates:</span>') +
      attackTmpList +
      (attackTmpList === "" ? "" : "</div>") +
      "<div>" +
      '<span style="font-weight: bold;">!CreatureGen -dmesg [lvl]</span>' +
      "</div>" +
      '<li style="padding-left: 10px;">' +
      "Dump to API-output console debug at the specified level (1-5) for the last token generated." +
      "</li>" +
      "</div>" +
      "</div>" +
      "</div>";
    sendFeedback(content);
  };

  /**
   * creatureGen - Main entry point
   * @param {{ content: any; type: string; playerid: any; }} msg - the data provided by the Roll 20 API
   */
 var creatureGen =function(msg) {
    var cmdName = "!CreatureGen";
    var msgTxt = msg.content;
    var args;
    if (
      msg.type === "api" &&
      msgTxt.indexOf(cmdName) !== -1 &&
      playerIsGM(msg.playerid)
    ) {
      args = msgTxt
        .replace(cmdName, "")
        .trim()
        .toLowerCase();
      if (args !== "") {
        if (locked) {
          sendFeedback(
            '<span style="color: #FF8D0B; font-weight: bold;">' +
              " BUSY </span>"
          );
        } else if (args.indexOf("-set-design") === 0) {
          args = args.replace("-set-design", "").trim();
          selectDesignTemplate(args);
        } else if (args.indexOf("-set-attack") === 0) {
          args = args.replace("-set-attack", "").trim();
          selectAttackTemplate(args);
        } else if (args.indexOf("-help") === 0) {
          showHelp();
        } else if (args.indexOf("-dmesg") === 0) {
          var level = 0;
          args = args.replace("-dmesg", "").trim();
          level = getBonusNumber(args, bonusEnum.SCALAR);
          creLogDump(level);
          sendFeedback(
            '<span style="color: #FF8D0B;">' +
              "Dumping debug from last <b>GENESIS</b> at level (" +
              level +
              ")" +
              "</span>"
          );
        } else if (args.indexOf("-player") === 0) {
          args = args.replace("-player", "").trim();
          doPlayerGenesis(msg, args);
        } else if (args.indexOf("-name") === 0) {
          args = args.replace("-name", "").trim();
          doNameGenesis(msg, args);
        } else {
          sendFeedback("Unknown CreatureGen command '" + args + "'");
          showHelp();
        }
      } else if (locked) {
        sendFeedback(
          '<span style="color: #FF8D0B; font-weight: bold;">' + " BUSY </span>"
        );
      } else {
        doGenesis(msg);
      }
    }
  };

  /**
   * Handle new graphics added
   */
  var handleAddGraphic = function(obj) {
    var type;
    var charSheet;

    if (!!(type = obj.get("_subtype"))) {
      if (type === "token") {
        charSheet = obj.get("represents");
        if (charSheet) {
          charSheet = getObj("character", charSheet);
          if (charSheet) {
            prepToken(obj, charSheet);
          }
        }
      }
    }
  };

  return {
    /**
     * Register Roll20 handlers
     */
    registerAPI: function() {
      on("chat:message", creatureGen);
      on("add:graphic", handleAddGraphic);
    },

    init: function() {
      var rc = true;
      fields.tmpAtk = atkTemplate;
      if (state.cgen_design) {
        rc = selectDesignTemplate(state.cgen_design.toLowerCase(), true);
      }
      if (!rc) {
        log("ERROR: state design template no longer exists, defaulting..");
        state.cgen_design = undefined;
      }
      if (state.cgen_attack) {
        rc = selectAttackTemplate(state.cgen_attack.toLowerCase(), true);
      }
      if (!rc) {
        log("ERROR: state attack template no longer exists, defaulting..");
        state.cgen_attack = undefined;
      }
    }
  };
})();

on("ready", function() {
  "use strict";
  CreatureGenPF.init();
  CreatureGenPF.registerAPI();
});
