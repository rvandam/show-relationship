// ==UserScript==
// @name       Show Relationship
// @version    0.1
// @description  Show relationship to you
// @match      https://familysearch.org/tree/*
// @copyright  2012+, You
// ==/UserScript==

var RELATED_URL = "https://familysearch.org/scopeservice/soi/related/";

var $ = unsafeWindow.jQuery;
if (unsafeWindow.console){
    GM_log = unsafeWindow.console.log;
} else if (console) {
    GM_log = console.log;
} else {
    GM_log = function(foo) { alert(foo.toString()) };
}

var interval = setInterval(fetch_relationships, 1000);
var pending = {};
//$(unsafeWindow.document).ajaxComplete(function(stuff1, stuff2, stuff3, stuff4) { console.log([stuff1, stuff2, stuff3, stuff4]) });
//$(unsafeWindow.document).ajaxComplete(fetch_relationships);

function fetch_relationships() {
    
    /* This section is for the descendancy view */
    var $fs_person_portraits = $(".fs-person-portrait");
    console.log($fs_person_portraits.length);
    //console.log($fs_person_portraits.map(function(person) { return $(person).attr('data-cmd-data'); }));
    
    //clearInterval(interval);
        
    var ids = $fs_person_portraits.each(function(i, person) {
        var $id = $(person).find('.fs-person-details__id');
        var id = $id.text();
        //console.log($(person), $id);
        //var json = $.parseJSON($(person).attr('data-cmd-data'));
        if (! id) return;
        fetch_relationship(id, $id);
    });
    
    /* This section is primarily for the single person view */

    // find person id to use in relationship api
    var $id = $(".person-id");
    var id = $id.text();
    if (! id) return;
    // skip if already calling ajax
    if (pending[id]) return;
    fetch_relationship(id, $id);
}

function fetch_relationship(id, $after) {
    // console.log(id);
    // skip if relationship already exists
    var $relationship = $(".person-relationship-" + id);
    if ($relationship.length) return;
    
    // return if this relationship is already being fetched
    if (pending[id]) return;

    // call api
    pending[id] = true;
    var url = RELATED_URL + id + ".json?a=10&d=4";
    $.getJSON(url, function(json, textStatus) { show_relationship(id, json, textStatus, $after) });
}

function show_relationship(id, json, textStatus, $after) {
    var relationship = ' (Unknown)'; // Related by marriage only or unrelated or relationship too distant)';
    console.log(id, json, textStatus);
    if (json && json.relationship) {
        var relations = relation_list(json);
        relationship = [
            ' (',
            //'Verbose: ', to_verbose(relations),
            //', Binary Ahnentafel: ', to_binary_ahnentafel(relations),
            //', Gender Ahnentafel: ', to_gender_ahnentafel(relations),
            //', Ahnentafel: ', to_ahnentafel(relations),
            //', Human: ', 
            to_cousin(relations, id),
            ')'
        ].join('');
    } else {
        console.log(json);
        console.log(textStatus);
    }

    $after.after($('<li>', { 'class': 'person-relationship-' + id, style: 'float: left; margin-left: 1em;' }).text(relationship));
    //delete pending[id];
}

function relation_list(json) {
    var relations = $.map(json.relationship, function(hash) { return hash.relationshipToPrevious || [] });
    // relations now looks like [null, 'FATHER', 'MOTHER', 'FATHER', 'DAUGHTER', 'SON']
    console.log(relations);
    return relations;
}

function to_verbose(relations) { return 'Your ' + relations.join("'s ").toLowerCase(); } // (Your father's mother's sister's wife)

var binary_ahnentafel_map = {
    FATHER: '1',
    MOTHER: '0',
};
function to_binary_ahnentafel(relations) { return '1' + $.map(relations, function(relation) { return binary_ahnentafel_map[relation] || '' }).join('') }
var gender_ahnentafel_map = {
    FATHER: 'M',
    MOTHER: 'F',
};
function to_gender_ahnentafel(relations) { return 'X' + $.map(relations, function(relation) { return gender_ahnentafel_map[relation] || 'X' }).join('') }
function to_ahnentafel(relations) { 
    var binaryish = to_binary_ahnentafel(relations);
    var ahnentafel = parseInt(binaryish, 2); // this will ignore everything after the first non [01], so we get the number for the common ancestor technically
    return ahnentafel;
}

// show's just the daughter's daughter portion after finding the common ancestor (the one used for the ahnentafel)
/*
function verbose_from_ahnentafel(relations) {
    var verbose = to_verbose(relations)
    verbose.shift() while verbose[0].match(/mother|father/);
    return verbose.join("'s ").toLowerCase();
}
*/

function is_male(rel) { return rel == 'FATHER' || rel == 'SON' || rel == 'HUSBAND'; }
function is_female(rel) { return rel == 'MOTHER' || rel == 'DAUGHTER' || rel == 'WIFE'; }
function is_parent(rel) { return rel == 'FATHER' || rel == 'MOTHER'}
function is_child(rel) { return rel == 'SON' || rel == 'DAUGHTER' }
function is_spouse(rel) { return rel == 'WIFE' || rel == 'HUSBAND' }

function to_cousin(relations, id) {
    var parent_count = 0;
    var child_count = 0;
    
    // this matrix is a condensed map based on counting parents and children
    // each row represents the generation of the common ancestor
    // each column represents the generation relative to the common ancestor
    
    // XXX below will be replaced with the last relationship in the chain
    // Xaternal will be replaced with paternal/maternal
    // PTH below will be replaced with parent_count - 2
    // CTH below will be replaced with child_count - 2
    // RTH below will be replaced with parent_count - child_count
    // if there is a male/female naming pair, they are split with a '|' pipe
    var matrix = [
        // common ancestor is self
        ['self', 'Xaternal grandXXX', 'great-grandXXX', 'CTH great-grandXXX'],
        
        // common ancestor is your parent
        ['XXX', 'brother|sister', 'nephew|niece', 'CTH great-nephew'],
        
        // common ancestor is your grandparent
        ['Xaternal grandXXX', 'uncle|aunt', 'CTH cousin', 'CTH cousin RTH removed'],
        
        // common ancestor is your great-grandparent
        ['great-grandXXX', 'great-uncle|great-aunt', 'CTH cousin RTH removed'],
        
        // common ancestor is your 2nd great-grandparent
        ['PTH great-grandXXX', 'PTH great-uncle|PTH great-aunt', 'CTH cousin RTH removed'],
    ];
    
    $.each(relations, function(i, relation) {
        //console.log(relation);
        if (is_parent(relation)) parent_count++;
        if (is_child(relation)) child_count++;
    });

    var pc = parent_count >= matrix.length ? matrix.length - 1 : parent_count;
    var cc = child_count >= matrix[pc].length ? matrix[pc].length - 1 : child_count;
    var relationship = matrix[pc][cc];
    //console.log(relations, parent_count, pc, child_count, cc, relationship);
    

	var first = relations[0];    
    var last = relations[relations.length - 1];
    if (! last) last = '';

    // choose male/female version of certain paired terms
    var pair = relationship.split(/\|/);
    if (pair.length > 1) {
		// left hand side is male, right hand side is female
    	if (is_male(last)) relationship = pair[0];
        if (is_female(last)) relationship = pair[1];
    }
    
	// if last in chain was someone's HUSBAND/WIFE then handle that
    // FIXME: is it possible for middle of chain to be husband/wife? Probably not, relationships seem to not cross marriages more than 1 degree
    if (is_spouse(last)) {
    	relationship = relationship + "'s " + last.toLowerCase();
        var prev = relations[relations.length - 2];
        if (prev) relationship = relationship.replace('XXX', prev.toLowerCase());
    }

    // make the substitutions noted above
    if (last) relationship = relationship.replace('XXX', last.toLowerCase());
    relationship = relationship.replace('PTH', to_ordinal(parent_count - 2));
    relationship = relationship.replace('CTH', to_ordinal(child_count - 2));
    relationship = relationship.replace('RTH', to_multiple(Math.abs(parent_count - child_count)));
    relationship = relationship.replace('Xaternal', is_male(first) ? 'paternal' : is_female(first) ? 'maternal' : '');
    


    return 'Your ' + relationship;
}

function to_ordinal(number) {
    var mod = number % 10;
    return number + '' + (mod == 1 ? 'st' : mod == 2 ? 'nd' : mod == 3 ? 'rd' : 'th');
}

function to_multiple(number) {
    return number == 1 ? 'once' : number == 2 ? 'twice' : number + ' times';
}

/*

named relationships in API
FATHER, MOTHER, SON, DAUGHTER, SPOUSE


relationships that we can calculate:
GRANDFATHER (PARENT, FATHER)
GRANDMOTHER (PARENT, MOTHER)
GREAT-GRANDFATHER (PARENT, PARENT, FATHER)
GREAT-GRANDMOTHER (PARENT, PARENT, MOTHER)

AUNT (PARENT, PARENT, DAUGHTER)
UNCLE (PARENT, PARENT, SON)
COUSIN (PARENT, PARENT, CHILD, CHILD)

GREAT-AUNT/UNCLE is (GRANDFATHER/MOTHER, CHILD)
1st COUSIN ONCE REMOVED is (PARENT, PARENT, CHILD, CHILD, CHILD) or (PARENT, PARENT, PARENT, CHILD, CHILD)
1st COUSIN TWICE REMOVED is (PARENT, PARENT, CHILD, CHILD, CHILD, CHILD) or (PARENT, PARENT, PARENT, PARENT, CHILD, CHILD)

nth COUSIN y REMOVED is sequence of parents followed by sequence of children where parents + children = n + y + 3
*/

/*
FATHER					1, 0
MOTHER					1, 0
SON					0, 1
DAUGHTER				0, 1
FATHER FATHER (paternal grandfather) 	2, 0
FATHER MOTHER (paternal grandmother) 	2, 0
FATHER SON (brother) 			1, 1
FATHER DAUGHTER (sister)		1, 1
MOTHER FATHER (maternal grandfather)	2, 0
MOTHER MOTHER (maternal grandmother)	2, 0
MOTHER SON (brother)			1, 1
MOTHER DAUGHTER (sister)		1, 1
SON FATHER (husband, not possible)
SON MOTHER (wife, not possible)
SON SON (grandson)			0, 2
SON DAUGHTER (granddaughter)		0, 2
DAUGHTER FATHER (husband, not possible)
DAUGHTER MOTHER (wife, not possible)
DAUGHTER SON (grandson)			0, 2
DAUGHTER DAUGHTER (granddaughter)	0, 2
FATHER FATHER FATHER (great-grandfather)3, 0
FATHER FATHER MOTHER (great-grandmother)3, 0
FATHER FATHER SON (uncle)		2, 1
FATHER FATHER DAUGHTER (aunt)		2, 1
FATHER MOTHER FATHER (great-grandfather)3, 0
FATHER MOTHER MOTHER (great-grandmother)3, 0
FATHER MOTHER SON (uncle)		2, 1
FATHER MOTHER DAUGHTER (aunt)		2, 1
FATHER SON FATHER (father, not possible)
FATHER SON MOTHER (mother, not possible)
FATHER SON SON (nephew)			1, 2
FATHER SON DAUGHTER (niece)		1, 2
FATHER DAUGHTER FATHER (father, not possible)
FATHER DAUGHTER MOTHER (mother, not possible)
FATHER DAUGHTER SON (nephew)		1, 2
FATHER DAUGHTER DAUGHTER (niece)	1, 2
SON SON SON (great-grandson)		0, 3
SON SON DAUGHTER (great-granddaughter)	0, 3
SON DAUGHTER SON (great-grandson)	0, 3
SON DAUGHTER DAUGHTER (great-granddaughter) 0, 3
DAUGHTER SON SON (great-grandson)	0, 3
DAUGHTER SON DAUGHTER (great-granddaughter) 0, 3
DAUGHTER DAUGHTER SON (great-grandson)	0, 3
DAUGHTER DAUGHTER DAUGHTER (great-granddaughter) 0, 3
FATHER FATHER FATHER FATHER (great-great-grandfather or 2nd great-grandfather)
FATHER FATHER FATHER MOTHER (great-great-grandmother or 2nd great-grandmother)
FATHER FATHER FATHER SON (greatuncle)	3, 1
FATHER FATHER FATHER DAUGHTER (greataunt) 3, 1
FATHER FATHER SON SON (cousin) 2, 2
FATHER FATHER FATHER SON SON SON (second cousin) 3, 3
FATHER FATHER FATHER SON SON (first cousin once removed) 3, 2
 */