/* global tinymce */

tinymce.PluginManager.add( 'toolbar', function( editor ) {

	var each = tinymce.each,
		Factory = tinymce.ui.Factory,
		dom = tinymce.DOM,
		settings = editor.settings,
		toolbar;

	editor.on( 'keyup mouseup nodechange', function() {
		if ( editor.selection.isCollapsed() ) {
			toolbar.hide();
			return;
		}

		setTimeout( function() {
			var element = editor.selection.getNode();

			if ( ! editor.selection.isCollapsed() &&
					editor.selection.getContent().replace( /<[^>]+>/g, '' ).trim() &&
					element.nodeName !== 'IMG' &&
					element.nodeName !== 'HR' &&
					element.id !== 'wp-title' &&
					! editor.wp.getView( element ) ) {
				if ( toolbar._visible ) {
					toolbar.setPos();
				} else {
					toolbar.show();
				}
			} else {
				toolbar.hide();
			}
		}, 50 );
	} );

	editor.on( 'blur', function() {
		toolbar.hide();
	} );

	function getParent( node, nodeName ) {
		while ( node ) {
			if ( node.nodeName === nodeName ) {
				return node;
			}

			node = node.parentNode;
		}

		return false;
	}

	editor.on( 'PreInit', function() {
		var toolbarItems = [],
			buttonGroup;

		// See theme.js
		each( settings.inlineToolbar, function( item ) {
			var itemName;

			function bindSelectorChanged() {
				var selection = editor.selection;

				if ( itemName === 'bullist' ) {
					selection.selectorChanged( 'ul > li', function( state, args ) {
						var nodeName,
							i = args.parents.length;

						while ( i-- ) {
							nodeName = args.parents[ i ].nodeName;

							if ( nodeName === 'OL' || nodeName === 'UL' ) {
								break;
							}
						}

						item.active( state && nodeName === 'UL' );
					} );
				}

				if ( itemName === 'numlist' ) {
					selection.selectorChanged( 'ol > li', function(state, args) {
						var nodeName,
							i = args.parents.length;

						while ( i-- ) {
							nodeName = args.parents[ i ].nodeName;

							if ( nodeName === 'OL' || nodeName === 'UL' ) {
								break;
							}
						}

						item.active( state && nodeName == 'OL' );
					} );
				}

				if ( item.settings.stateSelector ) {
					selection.selectorChanged( item.settings.stateSelector, function( state ) {
						item.active( state );
					}, true );
				}

				if ( item.settings.disabledStateSelector ) {
					selection.selectorChanged( item.settings.disabledStateSelector, function( state ) {
						item.disabled( state );
					} );
				}
			}

			if ( item === '|' ) {
				buttonGroup = null;
			} else {
				if ( Factory.has( item ) ) {
					item = {
						type: item
					};

					if ( settings.toolbar_items_size ) {
						item.size = settings.toolbar_items_size;
					}

					toolbarItems.push( item );
					buttonGroup = null;
				} else {
					if ( ! buttonGroup ) {
						buttonGroup = {
							type: 'buttongroup',
							items: []
						};
						toolbarItems.push( buttonGroup );
					}

					if ( editor.buttons[ item ] ) {
						itemName = item;
						item = editor.buttons[ itemName ];

						if ( typeof( item ) === 'function' ) {
							item = item();
						}

						item.type = item.type || 'button';

						if ( settings.toolbar_items_size ) {
							item.size = settings.toolbar_items_size;
						}

						// Start customisation.
						item.tooltip = false;

						if ( itemName === 'link' ) {
							item.onPostRender = function() {
								var self = this;

								editor.on( 'NodeChange', function( event ) {
									self.active( getParent( event.element, 'A' ) );
								} );
							};
						} else if ( itemName === 'unlink' ) {
							item.onPostRender = function() {
								var self = this;

								editor.on( 'NodeChange', function( event ) {
									self.disabled( event.element.nodeName !== 'A' && editor.selection.getContent().indexOf( '<a' ) === -1 );
								} );
							};
						}
						// End customisation.

						item = Factory.create( item );
						buttonGroup.items.push( item );

						if ( editor.initialized ) {
							bindSelectorChanged();
						} else {
							editor.on( 'init', bindSelectorChanged );
						}
					}
				}
			}
		} );

		toolbar = tinymce.ui.Factory.create( {
			type: 'panel',
			layout: 'stack',
			classes: 'inline-toolbar-grp popover',
			ariaRoot: true,
			ariaRemember: true,
			items: {
				type: 'toolbar',
				layout: 'flow',
				items: toolbarItems
			}
		} );

		toolbar.on( 'show', function() {
			this.setPos();
		} );

		toolbar.on( 'hide', function() {
			dom.removeClass( this.getEl(), 'mce-inline-toolbar-active' );
		} );

		dom.bind( window, 'resize', function() {
			toolbar.hide();
		} );

		toolbar.setPos = function() {
			var toolbarEl = this.getEl(),
				boundary = editor.selection.getRng().getBoundingClientRect(),
				boundaryMiddle = ( boundary.left + boundary.right ) / 2,
				toolbarHalf = toolbarEl.offsetWidth / 2,
				margin = parseInt( dom.getStyle( toolbarEl, 'margin-bottom', true ), 10),
				top, left, iFramePos;

			if ( boundary.top < toolbarEl.offsetHeight ) {
				dom.addClass( toolbarEl, 'mce-inline-toolbar-arrow-up' );
				dom.removeClass( toolbarEl, 'mce-inline-toolbar-arrow-down' );
				top = boundary.bottom + margin;
			} else {
				dom.addClass( toolbarEl, 'mce-inline-toolbar-arrow-down' );
				dom.removeClass( toolbarEl, 'mce-inline-toolbar-arrow-up' );
				top = boundary.top - toolbarEl.offsetHeight - margin;
			}

			left = boundaryMiddle - toolbarHalf;

			iFramePos = dom.getPos( editor.getContentAreaContainer().querySelector( 'iframe' ) );

			top = top + iFramePos.y;
			left = ( ( left + iFramePos.x ) > 0 ) ? left + iFramePos.x : 0;

			dom.setStyles( toolbarEl, { 'left': left, 'top': top } );

			// setTimeout( function() {
				dom.addClass( toolbarEl, 'mce-inline-toolbar-active' );
			// }, 100 );

			return this;
		};

		toolbar.renderTo( document.body ).hide();

		editor.inlineToolbar = toolbar;
	} );

	each( {
		H1: 'Heading 1',
		H2: 'Heading 2',
		H3: 'Heading 3',
		H4: 'Heading 4',
		H5: 'Heading 5',
		H6: 'Heading 6',
		Pre: 'Preformatted'
	}, function( text, name ) {
		var nameLower = name.toLowerCase();

		editor.addButton( nameLower, {
			tooltip: text,
			text: name,
			onclick: function() {
				editor.formatter.toggle( nameLower );
			},
			onPostRender: function() {
				var self = this;

				editor.on( 'nodeChange', function( event ) {
					each( event.parents, function( node ) {
						self.active( !! editor.formatter.matchNode( node, nameLower ) );
					} );
				} );
			}
		} );
	} );
} );
