/* global tinymce */

tinymce.PluginManager.add( 'title', function( editor ) {

	var Env = tinymce.Env,
		VK = tinymce.util.VK,
		originalTitle = tinymce.DOM.select( '#title' )[0];

	function dummyTitle() {
		var title = editor.dom.select( '#wp-title' )[0],
			body;
		if ( ! title ) {
			title = editor.dom.create(
				'h1',
				{ id: 'wp-title' },
				originalTitle.value || ( ( Env.ie && Env.ie < 11 ) ? '' : '<br data-mce-bogus="1" />' )
			);
			body = editor.getBody();
			body.insertBefore( title, body.firstChild );
		}
		return title;
	}

	if ( ! originalTitle ) {
		return;
	}

	editor.on( 'keydown', function( event ) {
		var dom = editor.dom,
			selection = editor.selection,
			title, range, node, padNode;

		if ( event.keyCode === VK.BACKSPACE ) {
			range = selection.getRng();
			node = selection.getNode();
			title = dummyTitle();
			if ( title &&
					( node.previousSibling === title ||
						node === title ) &&
					selection.isCollapsed() &&
					range.startOffset === 0 &&
					range.endOffset === 0 &&
					! dom.isEmpty( node ) ) {
				selection.select( title, true );
				selection.collapse();
				event.preventDefault();
			}
		} else if ( event.keyCode === VK.ENTER ) {
			title = dummyTitle();

			if ( title = selection.getNode() ) {
				padNode = dom.create( 'p' );

				if ( ! ( Env.ie && Env.ie < 11 ) ) {
					padNode.innerHTML = '<br data-mce-bogus="1">';
				}

				dom.insertAfter( padNode, title );

				editor.getBody().focus();
				editor.selection.setCursorLocation( padNode, 0 );
				editor.nodeChanged();
				event.preventDefault();
			}
		}
	} );

	editor.on( 'NodeChange blur', function() {
		var dom = editor.dom,
			title = dummyTitle(),
			firstP = dom.select( 'p' )[0],
			node = editor.selection.getNode();

		if ( dom.isEmpty( title ) && node !== title ) {
			dom.addClass( title, 'empty' );
		} else {
			dom.removeClass( title, 'empty' );
		}

		if ( firstP && dom.isEmpty( firstP ) && node !== firstP ) {
			dom.addClass( firstP, 'empty' );
		} else {
			dom.removeClass( firstP, 'empty' );
		}
	} );

	editor.on( 'NodeChange', function() {
		var title = dummyTitle();
		if ( title ) {
			originalTitle.value = title.textContent;
		}
	} );

	editor.on( 'LoadContent', dummyTitle );

	editor.on( 'PostProcess', function( event ) {
		if ( event.get ) {
			event.content = event.content.replace( /<H1[^>]+id="wp-title"[^>]*>[\s\S]*<\/H1>/gi, '' );
		}
	} );

	editor.on( 'show BeforeRenderUI', function() {
		tinymce.DOM.hide( 'titlediv' );
		jQuery( '#wp-content-editor-tools' ).css( {
			'height': '0',
			'visibility': 'hidden',
			'padding-top': '0'
		} );
	} );

	editor.on( 'hide', function() {
		tinymce.DOM.show( 'titlediv' );
		jQuery( '#wp-content-editor-tools' ).css( {
			'height': '',
			'visibility': '',
			'padding-top': ''
		} );
	} );

} );
