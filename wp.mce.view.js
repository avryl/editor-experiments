/* global tinymce */

/**
 * Note: this API is "experimental" meaning that it will probably change
 * in the next few releases based on feedback from 3.9.0.
 * If you decide to use it, please follow the development closely.
 */

window.wp = window.wp || {};

( function( $ ) {
	var views = {},
		instances = {},
		media = wp.media,
		viewOptions = ['encodedText'];

	wp.mce = wp.mce || {};

	/**
	 * wp.mce.View
	 *
	 * A Backbone-like View constructor intended for use when rendering a TinyMCE View. The main difference is
	 * that the TinyMCE View is not tied to a particular DOM node.
	 */
	wp.mce.View = function( options ) {
		var defs, self = this;

		options = options || {};
		this.type = options.type;
		if ( options.shortcode ) {
			this.shortcode = options.shortcode;
			if ( tinymce.settings._shortcodes[ options.type ] ) {
				this.settings = _.clone( tinymce.settings._shortcodes[ options.type ] );
				defs = _.clone( this.settings.attributes );
				_.each( defs, function( object, attribute ) {
					defs[ attribute ] = object.defaults;
				} );
				this.shortcode.attrs.named = _.defaults( this.shortcode.attrs.named, defs );
			}
			_.each( this.shortcode.attrs.named, function( value, key ) {
				self.shortcode.attrs.named[ key ] = value === 'false' ? false : value;
			} );
		}
		_.extend( this, _.pick( options, viewOptions ) );
		this.options = options;
		this.initialize.apply( this, arguments );
	};

	_.extend( wp.mce.View.prototype, {
		initialize: function() {},
		getHtml: function() {
			return '';
		},
		loadingPlaceholder: function() {
			return '' +
				'<div class="loading-placeholder">' +
					'<div class="dashicons dashicons-admin-media"></div>' +
					'<div class="wpview-loading"><ins></ins></div>' +
				'</div>';
		},
		render: function() {
			this.setContent(
				'<p class="wpview-selection-before">\u00a0</p>' +
				'<div class="wpview-body" contenteditable="false">' +
					'<div class="toolbar">' +
						( this.edit || views[ this.type ].edit ? '<div class="dashicons dashicons-edit edit"></div>' : '' ) +
						'<div class="dashicons dashicons-trash remove"></div>' +
					'</div>' +
					'<div class="wpview-edit-placeholder" style="height:200px;display:none;"></div>' +
					'<div class="wpview-content wpview-type-' + this.type + '">' +
						( this.getHtml() || this.loadingPlaceholder() ) +
					'</div>' +
					( this.overlay ? '<div class="wpview-overlay"></div>' : '' ) +
				'</div>' +
				'<p class="wpview-selection-after">\u00a0</p>',
				'wrap'
			);

			$( this ).trigger( 'ready' );
		},
		unbind: function() {},
		getEditors: function( callback ) {
			var editors = [];

			_.each( tinymce.editors, function( editor ) {
				if ( editor.plugins.wpview ) {
					if ( callback ) {
						callback( editor );
					}

					editors.push( editor );
				}
			}, this );

			return editors;
		},
		getNodes: function( callback ) {
			var nodes = [],
				self = this;

			this.getEditors( function( editor ) {
				$( editor.getBody() )
				.find( '[data-wpview-text="' + self.encodedText + '"]' )
				.each( function ( i, node ) {
					if ( callback ) {
						callback( editor, node, $( node ).find( '.wpview-content' ).get( 0 ) );
					}

					nodes.push( node );
				} );
			} );

			return nodes;
		},
		setContent: function( html, option ) {
			this.getNodes( function ( editor, node, content ) {
				var el = ( option === 'wrap' || option === 'replace' ) ? node : content,
					insert = html;

				if ( _.isString( insert ) ) {
					insert = editor.dom.createFragment( insert );
				}

				if ( option === 'replace' ) {
					editor.dom.replace( insert, el );
				} else {
					el.innerHTML = '';
					el.appendChild( insert );
				}
			} );
		},
		/* jshint scripturl: true */
		setIframes: function ( html ) {
			var MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;

			if ( html.indexOf( '<script' ) !== -1 ) {
				this.getNodes( function ( editor, node, content ) {
					var dom = editor.dom,
						iframe, iframeDoc, i, resize;

					content.innerHTML = '';

					iframe = dom.add( content, 'iframe', {
						src: tinymce.Env.ie ? 'javascript:""' : '',
						frameBorder: '0',
						allowTransparency: 'true',
						scrolling: 'no',
						'class': 'wpview-sandbox',
						style: {
							width: '100%',
							display: 'block'
						}
					} );

					iframeDoc = iframe.contentWindow.document;

					iframeDoc.open();
					iframeDoc.write(
						'<!DOCTYPE html>' +
						'<html>' +
							'<head>' +
								'<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />' +
							'</head>' +
							'<body data-context="iframe-sandbox" style="padding: 0; margin: 0;" class="' + editor.getBody().className + '">' +
								html +
							'</body>' +
						'</html>'
					);
					iframeDoc.close();

					resize = function() {
						// Make sure the iframe still exists.
						iframe.contentWindow && $( iframe ).height( $( iframeDoc.body ).height() );
					};

					if ( MutationObserver ) {
						new MutationObserver( _.debounce( function() {
							resize();
						}, 100 ) )
						.observe( iframeDoc.body, {
							attributes: true,
							childList: true,
							subtree: true
						} );
					} else {
						for ( i = 1; i < 6; i++ ) {
							setTimeout( resize, i * 700 );
						}
					}
				});
			} else {
				this.setContent( html );
			}
		},
		setError: function( message, dashicon ) {
			this.setContent(
				'<div class="wpview-error">' +
					'<div class="dashicons dashicons-' + ( dashicon ? dashicon : 'no' ) + '"></div>' +
					'<p>' + message + '</p>' +
				'</div>'
			);
		},
		inlineControls: function( arg ) {
			var self = this,
				attributes = this.shortcode.attrs.named,
				modal, $modal, $template, input = {}, firstInput,
				$view = $( arg.viewNode ),
				$viewEditPlaceholder = $view.find( '.wpview-edit-placeholder' ),
				editor = arg.editor;

			modal = document.createElement( 'DIV' );
			modal.className = 'wp-block-edit';

			document.body.appendChild( modal );

			$modal = $( modal );
			$template = $( $.trim( arg.template() ) );

			modal.appendChild( $template[0] );

			$modal.hide();

			$template
			.find( 'input' )
			.add( $template.find( 'select' ) )
			.add( $template.find( 'textarea' ) )
			.each( function() {
				var $this = $( this ),
					name = $this.attr( 'name' );

				if ( ! firstInput && $this.attr('type') !== 'hidden' ) {
					firstInput = $this;
				}

				if ( name ) {
					input[ '$' + name ] = $this;

					if ( attributes[ name ] ) {
						if ( $this.is( ':checkbox' ) ) {
							$this.prop( 'checked', attributes[ name ] );
						} else {
							$this.val( attributes[ name ] );
						}
					}
				}
			} )
			.blur( function() {
				setTimeout( function() {
					editor.focus();
				}, 100 );
			} );

			$( '#post' ).submit( function() {
				wp.mce.views.refreshView( self, self.formToShortcode( $template.serializeObject() ), $view[0], true );
			} );

			$view.on( 'select', function() {
				var editorBody = editor.getBody(),
					editorIframeOffset = $( editor.getContentAreaContainer().getElementsByTagName( 'iframe' ) ).offset();

				$modal.css( {
					opacity: 0,
					top: editorIframeOffset.top + editor.dom.getPos( $view[0] ).y,
					left: editorIframeOffset.left + editor.dom.getPos( editorBody ).x,
					width: editorBody.offsetWidth
				} );

				$viewEditPlaceholder
				.height( $modal.outerHeight() + 5 )
				.slideDown( 'fast', function() {
					$modal.css( 'opacity', '' ).fadeIn();
				} );
			} );

			editor.on( 'nodechange', function( event ) {
				if ( event.element !== $view.find( '.wpview-clipboard' )[0] ) {
					wp.mce.views.refreshView( self, self.formToShortcode( $template.serializeObject() ), $view[0], true );
					editor.undoManager.add();

					$modal.hide();
					$viewEditPlaceholder.hide();
				}
			} );

			$view.on( 'deselect', function() {
				$viewEditPlaceholder.slideUp();
			} );

			return {
				input: input,
				$template: $template,
				modal: modal
			};
		},
		formToShortcode: function( attributes ) {
			var text, defs, validKeys;
			if ( this.settings.attributes ) {
				defs = _.clone( this.settings.attributes );
				validKeys = [];
				_.each( defs, function( object, attribute ) {
					defs[ attribute ] = object.defaults;
					validKeys.push( attribute );
				} );
				attributes = _.defaults( attributes, defs );
				attributes = _.pick( attributes, validKeys );
			}
			text = '[' + this.type;
			_.each( attributes, function( value, key ) {
				text += ' ' + key + '="' + value + '"';
			} );
			text += ']';

			return text;
		}
	} );

	// take advantage of the Backbone extend method
	wp.mce.View.extend = Backbone.View.extend;

	/**
	 * wp.mce.views
	 *
	 * A set of utilities that simplifies adding custom UI within a TinyMCE editor.
	 * At its core, it serves as a series of converters, transforming text to a
	 * custom UI, and back again.
	 */
	wp.mce.views = function() {
		return instances[ _.isString( arguments[0] ) ? arguments[0] : $( arguments[0] ).attr( 'data-wpview-text' ) ];
	};

	/**
	 * wp.mce.views.register( type, view )
	 *
	 * Registers a new TinyMCE view.
	 *
	 * @param type
	 * @param constructor
	 */
	wp.mce.views.register = function( type, constructor ) {
		var defaultConstructor = {
				type: type,
				toView: function( content ) {
					var match = wp.shortcode.next( type, content );

					if ( ! match ) {
						return;
					}

					return {
						index: match.index,
						content: match.content,
						options: {
							attributes: match.shortcode.attrs.named,
							content: match.shortcode.content,
							tag: match.shortcode.tag,
							shortcode: match.shortcode
						}
					};
				}
			};

		if ( constructor && ! constructor.View ) {
			constructor.View = constructor;
		}

		constructor = constructor ? _.defaults( constructor, defaultConstructor ) : defaultConstructor;

		constructor.View = wp.mce.View.extend( constructor.View );

		views[ type ] = constructor;
	};

	/**
	 * wp.mce.views.get( id )
	 *
	 * Returns a TinyMCE view constructor.
	 */
	wp.mce.views.get = function( type ) {
		return views[ type ];
	};

	/**
	 * wp.mce.views.unregister( type )
	 *
	 * Unregisters a TinyMCE view.
	 */
	wp.mce.views.unregister = function( type ) {
		delete views[ type ];
	};

	/**
	 * wp.mce.views.unbind( editor )
	 *
	 * The editor DOM is being rebuilt, run cleanup.
	 */
	wp.mce.views.unbind = function() {
		_.each( instances, function( instance ) {
			instance.unbind();
		} );
	};

	/**
	 * toViews( content )
	 * Scans a `content` string for each view's pattern, replacing any
	 * matches with wrapper elements, and creates a new instance for
	 * every match, which triggers the related data to be fetched.
	 */
	wp.mce.views.toViews = function( content ) {
		var pieces = [ { content: content } ],
			current;

		_.each( views, function( view, viewType ) {
			current = pieces.slice();
			pieces  = [];

			_.each( current, function( piece ) {
				var remaining = piece.content,
					result;

				// Ignore processed pieces, but retain their location.
				if ( piece.processed ) {
					pieces.push( piece );
					return;
				}

				// Iterate through the string progressively matching views
				// and slicing the string as we go.
				while ( remaining && ( result = view.toView( remaining ) ) ) {
					// Any text before the match becomes an unprocessed piece.
					if ( result.index ) {
						pieces.push({ content: remaining.substring( 0, result.index ) });
					}

					// Add the processed piece for the match.
					pieces.push( {
						content: wp.mce.views.toView( viewType, result.content, result.options ),
						processed: true
					} );

					// Update the remaining content.
					remaining = remaining.slice( result.index + result.content.length );
				}

				// There are no additional matches. If any content remains,
				// add it as an unprocessed piece.
				if ( remaining ) {
					pieces.push({ content: remaining });
				}
			} );
		} );

		return _.pluck( pieces, 'content' ).join( '' );
	};

	/**
	 * Create a placeholder for a particular view type
	 *
	 * @param viewType
	 * @param text
	 * @param options
	 *
	 */
	wp.mce.views.toView = function( viewType, text, options ) {
		var view = wp.mce.views.get( viewType ),
			encodedText = window.encodeURIComponent( text ),
			instance, viewOptions;

		if ( ! view ) {
			return text;
		}

		if ( ! this.getInstance( encodedText ) ) {
			viewOptions = options;
			viewOptions.encodedText = encodedText;
			viewOptions.type = viewType;
			instance = new view.View( viewOptions );
			instances[ encodedText ] = instance;
		}

		return wp.html.string( {
			tag: 'div',
			attrs: {
				'class': 'wpview-wrap',
				'data-wpview-text': encodedText,
				'data-wpview-type': viewType
			},
			content: '\u00a0'
		} );
	};

	/**
	 * Refresh views after an update is made
	 *
	 * @param view {object} being refreshed
	 * @param text {string} textual representation of the view
	 */
	wp.mce.views.refreshView = function( instance, text, node, norender ) {
		var encodedText, newInstance, viewOptions, result;

		encodedText = window.encodeURIComponent( text );

		// Update the node's text.
		$( node ).attr( 'data-wpview-text', encodedText ).unbind( 'edit' );

		if ( ! this.getInstance( encodedText ) ) {
			// Parse the text.
			result = views[ instance.type ].toView( text );
			viewOptions = result.options;
			viewOptions.encodedText = encodedText;
			viewOptions.type = instance.type;

			// Create a new instance.
			newInstance = new views[ instance.type ].View( viewOptions );
			instances[ encodedText ] = newInstance;
		}

		norender || this.render();
	};

	wp.mce.views.getInstance = function( encodedText ) {
		return instances[ encodedText ];
	};

	/**
	 * render( scope )
	 *
	 * Renders any view instances inside a DOM node `scope`.
	 *
	 * View instances are detected by the presence of wrapper elements.
	 * To generate wrapper elements, pass your content through
	 * `wp.mce.view.toViews( content )`.
	 */
	wp.mce.views.render = function() {
		_.each( instances, function( instance ) {
			instance.render();
		} );
	};

	wp.mce.views.edit = function( node ) {
		var view = wp.mce.views.get( $( node ).data('wpview-type') );

		if ( view && view.edit ) {
			view.edit( node );
		}
	};

	wp.mce.views.register( 'gallery', {
		edit: function() {},
		template: media.template( 'editor-gallery' ),
		postID: $( '#post_ID' ).val(),

		initialize: function() {
			var self = this;

			$( this ).on( 'ready', function() {
				self.attachments = wp.media.gallery.attachments( self.shortcode, self.postID );
				self.attachments.more().done( function() {
					var attachments = false,
						attributes = self.shortcode.attrs.named,
						options;

					if ( self.attachments.length ) {
						attachments = self.attachments.toJSON();

						_.each( attachments, function( attachment ) {
							if ( attachment.sizes ) {
								if ( attachment.sizes.thumbnail ) {
									attachment.thumbnail = attachment.sizes.thumbnail;
								} else if ( attachment.sizes.full ) {
									attachment.thumbnail = attachment.sizes.full;
								}
							}
						} );
					}

					options = {
						attachments: attachments,
						columns: attributes.columns ? parseInt( attributes.columns, 10 ) : 3
					};

					self.setContent( self.template( options ) );

					self.getNodes( function( editor, node ) {
						$( node ).on( 'edit', function() {
							var gallery = wp.media.gallery,
								frame;

							frame = gallery.edit( window.decodeURIComponent( self.encodedText ) );

							frame.state( 'gallery-edit' ).on( 'update', function( selection ) {
								wp.mce.views.refreshView( self, gallery.shortcode( selection ).string(), node );
								frame.detach();
							} );
						} );
					} );
				} );
			} );
		}
	} );

	/**
	 * These are base methods that are shared by the audio and video shortcode's MCE controller.
	 *
	 * @mixin
	 */
	wp.mce.av = {
		View: {
			overlay: true,

			action: 'parse-media-shortcode',

			initialize: function( options ) {
				var self = this;

				this.shortcode = options.shortcode;

				_.bindAll( this, 'setIframes', 'setNodes', 'fetch', 'pausePlayers' );
				$( this ).on( 'ready', this.setNodes );

				$( document ).on( 'media:edit', this.pausePlayers );

				this.fetch();

				this.getEditors( function( editor ) {
					editor.on( 'hide', self.pausePlayers );
				});
			},

			setNodes: function () {
				if ( this.parsed ) {
					this.setIframes( this.parsed );
				}
			},

			fetch: function () {
				var self = this;

				wp.ajax.send( this.action, {
					data: {
						post_ID: $( '#post_ID' ).val() || 0,
						type: this.shortcode.tag,
						shortcode: this.shortcode.string()
					}
				} )
				.done( function( response ) {
					if ( response ) {
						self.parsed = response;
						self.setIframes( response );
					}
				} )
				.fail( function( response ) {
					if ( response && response.message ) {
						if ( ( response.type === 'not-embeddable' && self.type === 'embed' ) ||
							response.type === 'not-ssl' ) {

							self.setError( response.message, 'admin-media' );
						} else {
							self.setContent( '<p>' + self.original + '</p>', 'replace' );
						}
					} else if ( response && response.statusText ) {
						self.setError( response.statusText, 'admin-media' );
					}
				} );
			},

			pausePlayers: function() {
				this.getNodes( function( editor, node, content ) {
					var p, win,
						iframe = $( 'iframe.wpview-sandbox', content ).get(0);

					if ( iframe && ( win = iframe.contentWindow ) && win.mejs ) {
						for ( p in win.mejs.players ) {
							win.mejs.players[p].pause();
						}
					}
				});
			},

			unsetPlayers: function() {
				this.getNodes( function( editor, node, content ) {
					var p, win,
						iframe = $( 'iframe.wpview-sandbox', content ).get(0);

					if ( iframe && ( win = iframe.contentWindow ) && win.mejs ) {
						for ( p in win.mejs.players ) {
							win.mejs.players[p].remove();
						}
					}
				});
			},

			unbind: function() {
				this.pausePlayers();
				this.unsetPlayers();
			}
		},

		/**
		 * Called when a TinyMCE view is clicked for editing.
		 * - Parses the shortcode out of the element's data attribute
		 * - Calls the `edit` method on the shortcode model
		 * - Launches the model window
		 * - Bind's an `update` callback which updates the element's data attribute
		 *   re-renders the view
		 *
		 * @param {HTMLElement} node
		 */
		edit: function( node ) {
			var media = wp.media[ this.type ],
				self = this,
				frame, data, callback;

			$( document ).trigger( 'media:edit' );

			data = window.decodeURIComponent( $( node ).attr('data-wpview-text') );
			frame = media.edit( data );
			frame.on( 'close', function() {
				frame.detach();
			} );

			callback = function( selection ) {
				var shortcode = wp.media[ self.type ].shortcode( selection ).string();
				$( node ).attr( 'data-wpview-text', window.encodeURIComponent( shortcode ) );
				wp.mce.views.refreshView( self, shortcode );
				frame.detach();
			};
			if ( _.isArray( self.state ) ) {
				_.each( self.state, function (state) {
					frame.state( state ).on( 'update', callback );
				} );
			} else {
				frame.state( self.state ).on( 'update', callback );
			}
			frame.open();
		}
	};

	/**
	 * TinyMCE handler for the video shortcode
	 *
	 * @mixes wp.mce.av
	 */
	wp.mce.views.register( 'video', _.extend( {}, wp.mce.av, {
		state: 'video-details'
	} ) );

	/**
	 * TinyMCE handler for the audio shortcode
	 *
	 * @mixes wp.mce.av
	 */
	wp.mce.views.register( 'audio', _.extend( {}, wp.mce.av, {
		state: 'audio-details'
	} ) );

	/**
	 * TinyMCE handler for the playlist shortcode
	 *
	 * @mixes wp.mce.av
	 */
	wp.mce.views.register( 'playlist', _.extend( {}, wp.mce.av, {
		state: [ 'playlist-edit', 'video-playlist-edit' ]
	} ) );

	/**
	 * TinyMCE handler for the embed shortcode
	 */
	wp.mce.embedMixin = {
		View: _.extend( {}, wp.mce.av.View, {
			overlay: true,
			action: 'parse-embed',
			initialize: function( options ) {
				this.content = options.content;
				this.original = options.url || options.shortcode.string();

				if ( options.url ) {
					this.shortcode = media.embed.shortcode( {
						url: options.url
					} );
				} else {
					this.shortcode = options.shortcode;
				}

				_.bindAll( this, 'setIframes', 'setNodes', 'fetch' );
				$( this ).on( 'ready', this.setNodes );

				this.fetch();
			}
		} ),
		edit: function( node ) {
			var embed = media.embed,
				self = this,
				frame,
				data,
				isURL = 'embedURL' === this.type;

			$( document ).trigger( 'media:edit' );

			data = window.decodeURIComponent( $( node ).attr('data-wpview-text') );
			frame = embed.edit( data, isURL );
			frame.on( 'close', function() {
				frame.detach();
			} );
			frame.state( 'embed' ).props.on( 'change:url', function (model, url) {
				if ( ! url ) {
					return;
				}
				frame.state( 'embed' ).metadata = model.toJSON();
			} );
			frame.state( 'embed' ).on( 'select', function() {
				var shortcode;

				if ( isURL ) {
					shortcode = frame.state( 'embed' ).metadata.url;
				} else {
					shortcode = embed.shortcode( frame.state( 'embed' ).metadata ).string();
				}
				$( node ).attr( 'data-wpview-text', window.encodeURIComponent( shortcode ) );
				wp.mce.views.refreshView( self, shortcode );
				frame.detach();
			} );
			frame.open();
		}
	};

	wp.mce.views.register( 'embed', _.extend( {}, wp.mce.embedMixin ) );

	wp.mce.views.register( 'embedURL', _.extend( {}, wp.mce.embedMixin, {
		toView: function( content ) {
			var re = /(?:^|<p>)(https?:\/\/[^\s"]+?)(?:<\/p>\s*|$)/gi,
				match = re.exec( tinymce.trim( content ) );

			if ( ! match ) {
				return;
			}

			return {
				index: match.index,
				content: match[0],
				options: {
					url: match[1]
				}
			};
		}
	} ) );

	wp.mce.views.register( 'more', {
		toView: function( content ) {
			var re = /<!--(more|nextpage)(.*?)-->/g,
				match = re.exec( content );

			if ( ! match ) {
				return;
			}

			return {
				index: match.index,
				content: match[0],
				options: {
					_type: match[1],
					text: tinymce.trim( match[2] )
				}
			};
		},
		View: {
			initialize: function( options ) {
				this.text = options.text;
				this._type = options._type;
			},
			getHtml: function() {
				var text;

				if ( this._type === 'nextpage' ) {
					text = 'Page Break';
				} else if ( this.text ) {
					text = this.text;
				} else {
					text = '(more&hellip;)';
				}

				return '<p><span>' + text + '</span></p>';
			}
		}
	} );

} )( jQuery );
