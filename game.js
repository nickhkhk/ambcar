/* three.js r128 examples（EffectComposer、UnrealBloomPass，MIT）*/
( function () {

	/**
 * Full-screen textured quad shader
 */
	var CopyShader = {
		uniforms: {
			'tDiffuse': {
				value: null
			},
			'opacity': {
				value: 1.0
			}
		},
		vertexShader:
  /* glsl */
  `

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
		fragmentShader:
  /* glsl */
  `

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;

		}`
	};

	THREE.CopyShader = CopyShader;

} )();
( function () {

	/**
 * Luminosity
 * http://en.wikipedia.org/wiki/Luminosity
 */

	const LuminosityHighPassShader = {
		shaderID: 'luminosityHighPass',
		uniforms: {
			'tDiffuse': {
				value: null
			},
			'luminosityThreshold': {
				value: 1.0
			},
			'smoothWidth': {
				value: 1.0
			},
			'defaultColor': {
				value: new THREE.Color( 0x000000 )
			},
			'defaultOpacity': {
				value: 0.0
			}
		},
		vertexShader:
  /* glsl */
  `

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
		fragmentShader:
  /* glsl */
  `

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			vec3 luma = vec3( 0.299, 0.587, 0.114 );

			float v = dot( texel.xyz, luma );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`
	};

	THREE.LuminosityHighPassShader = LuminosityHighPassShader;

} )();
( function () {

	class EffectComposer {

		constructor( renderer, renderTarget ) {

			this.renderer = renderer;

			if ( renderTarget === undefined ) {

				const parameters = {
					minFilter: THREE.LinearFilter,
					magFilter: THREE.LinearFilter,
					format: THREE.RGBAFormat
				};
				const size = renderer.getSize( new THREE.Vector2() );
				this._pixelRatio = renderer.getPixelRatio();
				this._width = size.width;
				this._height = size.height;
				renderTarget = new THREE.WebGLRenderTarget( this._width * this._pixelRatio, this._height * this._pixelRatio, parameters );
				renderTarget.texture.name = 'EffectComposer.rt1';

			} else {

				this._pixelRatio = 1;
				this._width = renderTarget.width;
				this._height = renderTarget.height;

			}

			this.renderTarget1 = renderTarget;
			this.renderTarget2 = renderTarget.clone();
			this.renderTarget2.texture.name = 'EffectComposer.rt2';
			this.writeBuffer = this.renderTarget1;
			this.readBuffer = this.renderTarget2;
			this.renderToScreen = true;
			this.passes = []; // dependencies

			if ( THREE.CopyShader === undefined ) {

				console.error( 'THREE.EffectComposer relies on THREE.CopyShader' );

			}

			if ( THREE.ShaderPass === undefined ) {

				console.error( 'THREE.EffectComposer relies on THREE.ShaderPass' );

			}

			this.copyPass = new THREE.ShaderPass( THREE.CopyShader );
			this.clock = new THREE.Clock();

		}

		swapBuffers() {

			const tmp = this.readBuffer;
			this.readBuffer = this.writeBuffer;
			this.writeBuffer = tmp;

		}

		addPass( pass ) {

			this.passes.push( pass );
			pass.setSize( this._width * this._pixelRatio, this._height * this._pixelRatio );

		}

		insertPass( pass, index ) {

			this.passes.splice( index, 0, pass );
			pass.setSize( this._width * this._pixelRatio, this._height * this._pixelRatio );

		}

		removePass( pass ) {

			const index = this.passes.indexOf( pass );

			if ( index !== - 1 ) {

				this.passes.splice( index, 1 );

			}

		}

		isLastEnabledPass( passIndex ) {

			for ( let i = passIndex + 1; i < this.passes.length; i ++ ) {

				if ( this.passes[ i ].enabled ) {

					return false;

				}

			}

			return true;

		}

		render( deltaTime ) {

			// deltaTime value is in seconds
			if ( deltaTime === undefined ) {

				deltaTime = this.clock.getDelta();

			}

			const currentRenderTarget = this.renderer.getRenderTarget();
			let maskActive = false;

			for ( let i = 0, il = this.passes.length; i < il; i ++ ) {

				const pass = this.passes[ i ];
				if ( pass.enabled === false ) continue;
				pass.renderToScreen = this.renderToScreen && this.isLastEnabledPass( i );
				pass.render( this.renderer, this.writeBuffer, this.readBuffer, deltaTime, maskActive );

				if ( pass.needsSwap ) {

					if ( maskActive ) {

						const context = this.renderer.getContext();
						const stencil = this.renderer.state.buffers.stencil; //context.stencilFunc( context.NOTEQUAL, 1, 0xffffffff );

						stencil.setFunc( context.NOTEQUAL, 1, 0xffffffff );
						this.copyPass.render( this.renderer, this.writeBuffer, this.readBuffer, deltaTime ); //context.stencilFunc( context.EQUAL, 1, 0xffffffff );

						stencil.setFunc( context.EQUAL, 1, 0xffffffff );

					}

					this.swapBuffers();

				}

				if ( THREE.MaskPass !== undefined ) {

					if ( pass instanceof THREE.MaskPass ) {

						maskActive = true;

					} else if ( pass instanceof THREE.ClearMaskPass ) {

						maskActive = false;

					}

				}

			}

			this.renderer.setRenderTarget( currentRenderTarget );

		}

		reset( renderTarget ) {

			if ( renderTarget === undefined ) {

				const size = this.renderer.getSize( new THREE.Vector2() );
				this._pixelRatio = this.renderer.getPixelRatio();
				this._width = size.width;
				this._height = size.height;
				renderTarget = this.renderTarget1.clone();
				renderTarget.setSize( this._width * this._pixelRatio, this._height * this._pixelRatio );

			}

			this.renderTarget1.dispose();
			this.renderTarget2.dispose();
			this.renderTarget1 = renderTarget;
			this.renderTarget2 = renderTarget.clone();
			this.writeBuffer = this.renderTarget1;
			this.readBuffer = this.renderTarget2;

		}

		setSize( width, height ) {

			this._width = width;
			this._height = height;
			const effectiveWidth = this._width * this._pixelRatio;
			const effectiveHeight = this._height * this._pixelRatio;
			this.renderTarget1.setSize( effectiveWidth, effectiveHeight );
			this.renderTarget2.setSize( effectiveWidth, effectiveHeight );

			for ( let i = 0; i < this.passes.length; i ++ ) {

				this.passes[ i ].setSize( effectiveWidth, effectiveHeight );

			}

		}

		setPixelRatio( pixelRatio ) {

			this._pixelRatio = pixelRatio;
			this.setSize( this._width, this._height );

		}

	}

	class Pass {

		constructor() {

			// if set to true, the pass is processed by the composer
			this.enabled = true; // if set to true, the pass indicates to swap read and write buffer after rendering

			this.needsSwap = true; // if set to true, the pass clears its buffer before rendering

			this.clear = false; // if set to true, the result of the pass is rendered to screen. This is set automatically by EffectComposer.

			this.renderToScreen = false;

		}

		setSize( ) {}

		render( ) {

			console.error( 'THREE.Pass: .render() must be implemented in derived pass.' );

		}

	} // Helper for passes that need to fill the viewport with a single quad.


	const _camera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 ); // https://github.com/mrdoob/three.js/pull/21358


	const _geometry = new THREE.BufferGeometry();

	_geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [ - 1, 3, 0, - 1, - 1, 0, 3, - 1, 0 ], 3 ) );

	_geometry.setAttribute( 'uv', new THREE.Float32BufferAttribute( [ 0, 2, 0, 0, 2, 0 ], 2 ) );

	class FullScreenQuad {

		constructor( material ) {

			this._mesh = new THREE.Mesh( _geometry, material );

		}

		dispose() {

			this._mesh.geometry.dispose();

		}

		render( renderer ) {

			renderer.render( this._mesh, _camera );

		}

		get material() {

			return this._mesh.material;

		}

		set material( value ) {

			this._mesh.material = value;

		}

	}

	THREE.EffectComposer = EffectComposer;
	THREE.FullScreenQuad = FullScreenQuad;
	THREE.Pass = Pass;

} )();
( function () {

	class RenderPass extends THREE.Pass {

		constructor( scene, camera, overrideMaterial, clearColor, clearAlpha ) {

			super();
			this.scene = scene;
			this.camera = camera;
			this.overrideMaterial = overrideMaterial;
			this.clearColor = clearColor;
			this.clearAlpha = clearAlpha !== undefined ? clearAlpha : 0;
			this.clear = true;
			this.clearDepth = false;
			this.needsSwap = false;
			this._oldClearColor = new THREE.Color();

		}

		render( renderer, writeBuffer, readBuffer
			/*, deltaTime, maskActive */
		) {

			const oldAutoClear = renderer.autoClear;
			renderer.autoClear = false;
			let oldClearAlpha, oldOverrideMaterial;

			if ( this.overrideMaterial !== undefined ) {

				oldOverrideMaterial = this.scene.overrideMaterial;
				this.scene.overrideMaterial = this.overrideMaterial;

			}

			if ( this.clearColor ) {

				renderer.getClearColor( this._oldClearColor );
				oldClearAlpha = renderer.getClearAlpha();
				renderer.setClearColor( this.clearColor, this.clearAlpha );

			}

			if ( this.clearDepth ) {

				renderer.clearDepth();

			}

			renderer.setRenderTarget( this.renderToScreen ? null : readBuffer ); // TODO: Avoid using autoClear properties, see https://github.com/mrdoob/three.js/pull/15571#issuecomment-465669600

			if ( this.clear ) renderer.clear( renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil );
			renderer.render( this.scene, this.camera );

			if ( this.clearColor ) {

				renderer.setClearColor( this._oldClearColor, oldClearAlpha );

			}

			if ( this.overrideMaterial !== undefined ) {

				this.scene.overrideMaterial = oldOverrideMaterial;

			}

			renderer.autoClear = oldAutoClear;

		}

	}

	THREE.RenderPass = RenderPass;

} )();
( function () {

	class ShaderPass extends THREE.Pass {

		constructor( shader, textureID ) {

			super();
			this.textureID = textureID !== undefined ? textureID : 'tDiffuse';

			if ( shader instanceof THREE.ShaderMaterial ) {

				this.uniforms = shader.uniforms;
				this.material = shader;

			} else if ( shader ) {

				this.uniforms = THREE.UniformsUtils.clone( shader.uniforms );
				this.material = new THREE.ShaderMaterial( {
					defines: Object.assign( {}, shader.defines ),
					uniforms: this.uniforms,
					vertexShader: shader.vertexShader,
					fragmentShader: shader.fragmentShader
				} );

			}

			this.fsQuad = new THREE.FullScreenQuad( this.material );

		}

		render( renderer, writeBuffer, readBuffer
			/*, deltaTime, maskActive */
		) {

			if ( this.uniforms[ this.textureID ] ) {

				this.uniforms[ this.textureID ].value = readBuffer.texture;

			}

			this.fsQuad.material = this.material;

			if ( this.renderToScreen ) {

				renderer.setRenderTarget( null );
				this.fsQuad.render( renderer );

			} else {

				renderer.setRenderTarget( writeBuffer ); // TODO: Avoid using autoClear properties, see https://github.com/mrdoob/three.js/pull/15571#issuecomment-465669600

				if ( this.clear ) renderer.clear( renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil );
				this.fsQuad.render( renderer );

			}

		}

	}

	THREE.ShaderPass = ShaderPass;

} )();
( function () {

	/**
 * UnrealBloomPass is inspired by the bloom pass of Unreal Engine. It creates a
 * mip map chain of bloom textures and blurs them with different radii. Because
 * of the weighted combination of mips, and because larger blurs are done on
 * higher mips, this effect provides good quality and performance.
 *
 * Reference:
 * - https://docs.unrealengine.com/latest/INT/Engine/Rendering/PostProcessEffects/Bloom/
 */

	class UnrealBloomPass extends THREE.Pass {

		constructor( resolution, strength, radius, threshold ) {

			super();
			this.strength = strength !== undefined ? strength : 1;
			this.radius = radius;
			this.threshold = threshold;
			this.resolution = resolution !== undefined ? new THREE.Vector2( resolution.x, resolution.y ) : new THREE.Vector2( 256, 256 ); // create color only once here, reuse it later inside the render function

			this.clearColor = new THREE.Color( 0, 0, 0 ); // render targets

			const pars = {
				minFilter: THREE.LinearFilter,
				magFilter: THREE.LinearFilter,
				format: THREE.RGBAFormat
			};
			this.renderTargetsHorizontal = [];
			this.renderTargetsVertical = [];
			this.nMips = 5;
			let resx = Math.round( this.resolution.x / 2 );
			let resy = Math.round( this.resolution.y / 2 );
			this.renderTargetBright = new THREE.WebGLRenderTarget( resx, resy, pars );
			this.renderTargetBright.texture.name = 'UnrealBloomPass.bright';
			this.renderTargetBright.texture.generateMipmaps = false;

			for ( let i = 0; i < this.nMips; i ++ ) {

				const renderTargetHorizonal = new THREE.WebGLRenderTarget( resx, resy, pars );
				renderTargetHorizonal.texture.name = 'UnrealBloomPass.h' + i;
				renderTargetHorizonal.texture.generateMipmaps = false;
				this.renderTargetsHorizontal.push( renderTargetHorizonal );
				const renderTargetVertical = new THREE.WebGLRenderTarget( resx, resy, pars );
				renderTargetVertical.texture.name = 'UnrealBloomPass.v' + i;
				renderTargetVertical.texture.generateMipmaps = false;
				this.renderTargetsVertical.push( renderTargetVertical );
				resx = Math.round( resx / 2 );
				resy = Math.round( resy / 2 );

			} // luminosity high pass material


			if ( THREE.LuminosityHighPassShader === undefined ) console.error( 'THREE.UnrealBloomPass relies on THREE.LuminosityHighPassShader' );
			const highPassShader = THREE.LuminosityHighPassShader;
			this.highPassUniforms = THREE.UniformsUtils.clone( highPassShader.uniforms );
			this.highPassUniforms[ 'luminosityThreshold' ].value = threshold;
			this.highPassUniforms[ 'smoothWidth' ].value = 0.01;
			this.materialHighPassFilter = new THREE.ShaderMaterial( {
				uniforms: this.highPassUniforms,
				vertexShader: highPassShader.vertexShader,
				fragmentShader: highPassShader.fragmentShader,
				defines: {}
			} ); // Gaussian Blur Materials

			this.separableBlurMaterials = [];
			const kernelSizeArray = [ 3, 5, 7, 9, 11 ];
			resx = Math.round( this.resolution.x / 2 );
			resy = Math.round( this.resolution.y / 2 );

			for ( let i = 0; i < this.nMips; i ++ ) {

				this.separableBlurMaterials.push( this.getSeperableBlurMaterial( kernelSizeArray[ i ] ) );
				this.separableBlurMaterials[ i ].uniforms[ 'texSize' ].value = new THREE.Vector2( resx, resy );
				resx = Math.round( resx / 2 );
				resy = Math.round( resy / 2 );

			} // Composite material


			this.compositeMaterial = this.getCompositeMaterial( this.nMips );
			this.compositeMaterial.uniforms[ 'blurTexture1' ].value = this.renderTargetsVertical[ 0 ].texture;
			this.compositeMaterial.uniforms[ 'blurTexture2' ].value = this.renderTargetsVertical[ 1 ].texture;
			this.compositeMaterial.uniforms[ 'blurTexture3' ].value = this.renderTargetsVertical[ 2 ].texture;
			this.compositeMaterial.uniforms[ 'blurTexture4' ].value = this.renderTargetsVertical[ 3 ].texture;
			this.compositeMaterial.uniforms[ 'blurTexture5' ].value = this.renderTargetsVertical[ 4 ].texture;
			this.compositeMaterial.uniforms[ 'bloomStrength' ].value = strength;
			this.compositeMaterial.uniforms[ 'bloomRadius' ].value = 0.1;
			this.compositeMaterial.needsUpdate = true;
			const bloomFactors = [ 1.0, 0.8, 0.6, 0.4, 0.2 ];
			this.compositeMaterial.uniforms[ 'bloomFactors' ].value = bloomFactors;
			this.bloomTintColors = [ new THREE.Vector3( 1, 1, 1 ), new THREE.Vector3( 1, 1, 1 ), new THREE.Vector3( 1, 1, 1 ), new THREE.Vector3( 1, 1, 1 ), new THREE.Vector3( 1, 1, 1 ) ];
			this.compositeMaterial.uniforms[ 'bloomTintColors' ].value = this.bloomTintColors; // copy material

			if ( THREE.CopyShader === undefined ) {

				console.error( 'THREE.UnrealBloomPass relies on THREE.CopyShader' );

			}

			const copyShader = THREE.CopyShader;
			this.copyUniforms = THREE.UniformsUtils.clone( copyShader.uniforms );
			this.copyUniforms[ 'opacity' ].value = 1.0;
			this.materialCopy = new THREE.ShaderMaterial( {
				uniforms: this.copyUniforms,
				vertexShader: copyShader.vertexShader,
				fragmentShader: copyShader.fragmentShader,
				blending: THREE.AdditiveBlending,
				depthTest: false,
				depthWrite: false,
				transparent: true
			} );
			this.enabled = true;
			this.needsSwap = false;
			this._oldClearColor = new THREE.Color();
			this.oldClearAlpha = 1;
			this.basic = new THREE.MeshBasicMaterial();
			this.fsQuad = new THREE.FullScreenQuad( null );

		}

		dispose() {

			for ( let i = 0; i < this.renderTargetsHorizontal.length; i ++ ) {

				this.renderTargetsHorizontal[ i ].dispose();

			}

			for ( let i = 0; i < this.renderTargetsVertical.length; i ++ ) {

				this.renderTargetsVertical[ i ].dispose();

			}

			this.renderTargetBright.dispose();

		}

		setSize( width, height ) {

			let resx = Math.round( width / 2 );
			let resy = Math.round( height / 2 );
			this.renderTargetBright.setSize( resx, resy );

			for ( let i = 0; i < this.nMips; i ++ ) {

				this.renderTargetsHorizontal[ i ].setSize( resx, resy );
				this.renderTargetsVertical[ i ].setSize( resx, resy );
				this.separableBlurMaterials[ i ].uniforms[ 'texSize' ].value = new THREE.Vector2( resx, resy );
				resx = Math.round( resx / 2 );
				resy = Math.round( resy / 2 );

			}

		}

		render( renderer, writeBuffer, readBuffer, deltaTime, maskActive ) {

			renderer.getClearColor( this._oldClearColor );
			this.oldClearAlpha = renderer.getClearAlpha();
			const oldAutoClear = renderer.autoClear;
			renderer.autoClear = false;
			renderer.setClearColor( this.clearColor, 0 );
			if ( maskActive ) renderer.state.buffers.stencil.setTest( false ); // Render input to screen

			if ( this.renderToScreen ) {

				this.fsQuad.material = this.basic;
				this.basic.map = readBuffer.texture;
				renderer.setRenderTarget( null );
				renderer.clear();
				this.fsQuad.render( renderer );

			} // 1. Extract Bright Areas


			this.highPassUniforms[ 'tDiffuse' ].value = readBuffer.texture;
			this.highPassUniforms[ 'luminosityThreshold' ].value = this.threshold;
			this.fsQuad.material = this.materialHighPassFilter;
			renderer.setRenderTarget( this.renderTargetBright );
			renderer.clear();
			this.fsQuad.render( renderer ); // 2. Blur All the mips progressively

			let inputRenderTarget = this.renderTargetBright;

			for ( let i = 0; i < this.nMips; i ++ ) {

				this.fsQuad.material = this.separableBlurMaterials[ i ];
				this.separableBlurMaterials[ i ].uniforms[ 'colorTexture' ].value = inputRenderTarget.texture;
				this.separableBlurMaterials[ i ].uniforms[ 'direction' ].value = UnrealBloomPass.BlurDirectionX;
				renderer.setRenderTarget( this.renderTargetsHorizontal[ i ] );
				renderer.clear();
				this.fsQuad.render( renderer );
				this.separableBlurMaterials[ i ].uniforms[ 'colorTexture' ].value = this.renderTargetsHorizontal[ i ].texture;
				this.separableBlurMaterials[ i ].uniforms[ 'direction' ].value = UnrealBloomPass.BlurDirectionY;
				renderer.setRenderTarget( this.renderTargetsVertical[ i ] );
				renderer.clear();
				this.fsQuad.render( renderer );
				inputRenderTarget = this.renderTargetsVertical[ i ];

			} // Composite All the mips


			this.fsQuad.material = this.compositeMaterial;
			this.compositeMaterial.uniforms[ 'bloomStrength' ].value = this.strength;
			this.compositeMaterial.uniforms[ 'bloomRadius' ].value = this.radius;
			this.compositeMaterial.uniforms[ 'bloomTintColors' ].value = this.bloomTintColors;
			renderer.setRenderTarget( this.renderTargetsHorizontal[ 0 ] );
			renderer.clear();
			this.fsQuad.render( renderer ); // Blend it additively over the input texture

			this.fsQuad.material = this.materialCopy;
			this.copyUniforms[ 'tDiffuse' ].value = this.renderTargetsHorizontal[ 0 ].texture;
			if ( maskActive ) renderer.state.buffers.stencil.setTest( true );

			if ( this.renderToScreen ) {

				renderer.setRenderTarget( null );
				this.fsQuad.render( renderer );

			} else {

				renderer.setRenderTarget( readBuffer );
				this.fsQuad.render( renderer );

			} // Restore renderer settings


			renderer.setClearColor( this._oldClearColor, this.oldClearAlpha );
			renderer.autoClear = oldAutoClear;

		}

		getSeperableBlurMaterial( kernelRadius ) {

			return new THREE.ShaderMaterial( {
				defines: {
					'KERNEL_RADIUS': kernelRadius,
					'SIGMA': kernelRadius
				},
				uniforms: {
					'colorTexture': {
						value: null
					},
					'texSize': {
						value: new THREE.Vector2( 0.5, 0.5 )
					},
					'direction': {
						value: new THREE.Vector2( 0.5, 0.5 )
					}
				},
				vertexShader: `varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,
				fragmentShader: `#include <common>
				varying vec2 vUv;
				uniform sampler2D colorTexture;
				uniform vec2 texSize;
				uniform vec2 direction;

				float gaussianPdf(in float x, in float sigma) {
					return 0.39894 * exp( -0.5 * x * x/( sigma * sigma))/sigma;
				}
				void main() {
					vec2 invSize = 1.0 / texSize;
					float fSigma = float(SIGMA);
					float weightSum = gaussianPdf(0.0, fSigma);
					vec3 diffuseSum = texture2D( colorTexture, vUv).rgb * weightSum;
					for( int i = 1; i < KERNEL_RADIUS; i ++ ) {
						float x = float(i);
						float w = gaussianPdf(x, fSigma);
						vec2 uvOffset = direction * invSize * x;
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset).rgb;
						diffuseSum += (sample1 + sample2) * w;
						weightSum += 2.0 * w;
					}
					gl_FragColor = vec4(diffuseSum/weightSum, 1.0);
				}`
			} );

		}

		getCompositeMaterial( nMips ) {

			return new THREE.ShaderMaterial( {
				defines: {
					'NUM_MIPS': nMips
				},
				uniforms: {
					'blurTexture1': {
						value: null
					},
					'blurTexture2': {
						value: null
					},
					'blurTexture3': {
						value: null
					},
					'blurTexture4': {
						value: null
					},
					'blurTexture5': {
						value: null
					},
					'dirtTexture': {
						value: null
					},
					'bloomStrength': {
						value: 1.0
					},
					'bloomFactors': {
						value: null
					},
					'bloomTintColors': {
						value: null
					},
					'bloomRadius': {
						value: 0.0
					}
				},
				vertexShader: `varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,
				fragmentShader: `varying vec2 vUv;
				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform sampler2D dirtTexture;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor(const in float factor) {
					float mirrorFactor = 1.2 - factor;
					return mix(factor, mirrorFactor, bloomRadius);
				}

				void main() {
					gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) +
						lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) +
						lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) +
						lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) +
						lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv) );
				}`
			} );

		}

	}

	UnrealBloomPass.BlurDirectionX = new THREE.Vector2( 1.0, 0.0 );
	UnrealBloomPass.BlurDirectionY = new THREE.Vector2( 0.0, 1.0 );

	THREE.UnrealBloomPass = UnrealBloomPass;

} )();

(function(){
"use strict";
/* ================= Q 版屯門：城市生成 ================= */
const C={sky:0xbfe4fb,ground:0xc9d6b8,road:0x5d6470,line:0xffffff,
  amb:0xfdfdfd,red:0xe8323c,hiviz:0xd7ff2e,glass:0x33475b,dark:0x2b2d33,
  jacket:0xff7a1a,reflect:0xe9edf2,navy:0x24324a,skin:0xffd7b5,hair:0x3b2f2a,tree:0x6fcf5a,trunk:0xa9744f};
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const $=id=>document.getElementById(id);
const R=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
R.setPixelRatio(Math.min(devicePixelRatio,1.3)); R.shadowMap.enabled=true; R.shadowMap.type=THREE.PCFShadowMap;
$('stage').appendChild(R.domElement);
const scene=new THREE.Scene(); scene.background=new THREE.Color(C.sky); scene.fog=new THREE.Fog(C.sky,200,560);
const cam=new THREE.PerspectiveCamera(55,1,0.5,2400);

const M=(c,o={})=>new THREE.MeshStandardMaterial({color:c,roughness:o.r??0.75,metalness:0,emissive:o.e||0,transparent:!!o.op,opacity:o.op??1});
function add(geo,mat,p,x=0,y=0,z=0,cast=true){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=cast;m.receiveShadow=true;p.add(m);return m;}
function rbox(w,h,d,r){ r=Math.min(r,w/2-0.01,h/2-0.01,d/2-0.01); if(r<=0.01) return new THREE.BoxGeometry(w,h,d);
  const s=new THREE.Shape(),x=-w/2+r,y=-h/2+r,ww=w-2*r,hh=h-2*r;
  s.moveTo(x,-h/2);s.lineTo(x+ww,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,y);s.lineTo(w/2,y+hh);s.quadraticCurveTo(w/2,h/2,x+ww,h/2);
  s.lineTo(x,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,y+hh);s.lineTo(-w/2,y);s.quadraticCurveTo(-w/2,-h/2,x,-h/2);
  const g=new THREE.ExtrudeGeometry(s,{depth:d-2*r,bevelEnabled:true,bevelThickness:r,bevelSize:0,bevelSegments:3,curveSegments:4});
  g.translate(0,0,-(d-2*r)/2); g.computeVertexNormals(); return g; }
const sph=r=>new THREE.SphereGeometry(r,24,16), cyl=(a,b,h,s=20)=>new THREE.CylinderGeometry(a,b,h,s);
function tex(lines,bg,fg,w,h){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');
  if(bg){g.fillStyle=bg;g.fillRect(0,0,w,h)} g.fillStyle=fg;g.textAlign='center';g.textBaseline='middle';
  lines.forEach((l,i)=>{g.font=l.f;g.fillText(l.t,w/2,h*(i+1)/(lines.length+1))}); const t=new THREE.CanvasTexture(c);t.anisotropy=4;return t;}


function drawStar(g,sx,sy,r){
  g.fillStyle='#1f4fbf';
  for(let k=0;k<3;k++){ g.save(); g.translate(sx,sy); g.rotate(k*Math.PI/3); g.fillRect(-r*0.22,-r,r*0.44,r*2); g.restore(); }
  g.strokeStyle='#ffffff'; g.lineWidth=Math.max(2,r*0.07); g.beginPath(); g.moveTo(sx,sy-r*0.75); g.lineTo(sx,sy+r*0.75); g.stroke();
  g.lineWidth=Math.max(2,r*0.05); g.beginPath(); for(let t=0;t<=1.001;t+=0.05){ const yy=sy-r*0.6+t*r*1.2, xx=sx+Math.sin(t*Math.PI*4)*r*0.14; t?g.lineTo(xx,yy):g.moveTo(xx,yy);} g.stroke();
}
const REAR_CACHE={};
// 車尾相片貼圖（真實 A570 車尾相，車號同車牌已清走，再由程式寫上自己車號）。600×620，車門：x 120–303／303–487，y 33–497；下面 520–620 係泵把位置
const REAR_PHOTO=new Image(); let REAR_PHOTO_OK=false;
REAR_PHOTO.onload=()=>{ REAR_PHOTO_OK=true; for(const k in REAR_CACHE){ const c=REAR_CACHE[k]; if(c.__photo) c.__photo(); }
  try{ scene.traverse(o=>{ const m=o.material; if(m&&m.map&&m.map.image&&m.map.image.__photo) m.map.needsUpdate=true; }); }catch(e){} };
REAR_PHOTO.src='data:image/jpeg;base64,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';
const REAR_DOOR={x0:120,xm:303,x1:487,y0:33,y1:497};
function rearTex(body,base='#ffe500'){ const key=base+CALLSIGN+(body?1:0); if(REAR_CACHE[key]) return REAR_CACHE[key]; return REAR_CACHE[key]=rearTex0(body,base); }
function rearTex0(body,base){
  // 車尾整個面（闊 3.0 × 高 3.1）。座標用 600×620，畫喺 2 倍解像度。參考消防處救護車（Design C1）車尾：
  // 下半紅黃倒 V 人字反光、兩邊車柱亦有人字、中間黃底紅字「救 AMBULANCE 護」、兩扇門酒紅圓角窗、車號、KEEP CLEAR
  const S2=2, W=600,H=620,c=document.createElement('canvas'); c.width=W*S2; c.height=H*S2; const g=c.getContext('2d'); g.scale(S2,S2);
  g.fillStyle=base; g.fillRect(0,0,W,H);
  const RED='#e3141f', YEL=base;
  const chev=(x0,y0,x1,y1,apexX,sw)=>{ g.save(); g.beginPath(); g.rect(x0,y0,x1-x0,y1-y0); g.clip(); g.fillStyle=RED;
    for(let o=y0-(x1-x0)-sw*4;o<y1+sw*2;o+=sw*2){ // 由頂點向兩邊斜落嘅紅帶（45°）
      g.beginPath(); g.moveTo(x0,o+(apexX-x0)); g.lineTo(apexX,o); g.lineTo(apexX,o+sw*1.414); g.lineTo(x0,o+(apexX-x0)+sw*1.414); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(x1,o+(x1-apexX)); g.lineTo(apexX,o); g.lineTo(apexX,o+sw*1.414); g.lineTo(x1,o+(x1-apexX)+sw*1.414); g.closePath(); g.fill(); }
    g.restore(); };
  // 下半人字（窗以下成個車尾）＋兩邊車柱人字（由頂到底）
  chev(0,352,W,H,W/2,24); chev(0,150,60,352,0,20); chev(W-60,150,W,352,W,20);
  // 「救 AMBULANCE 護」黃底橫帶
  g.fillStyle=YEL; g.fillRect(0,288,W,64); g.fillStyle=RED; g.fillRect(0,286,W,3); g.fillRect(0,351,W,3);
  g.textAlign='center'; g.textBaseline='middle'; g.fillStyle=RED;
  g.font='900 46px sans-serif'; g.fillText('救',34,321); g.fillText('護',W-34,321);
  g.font='900 56px "Arial Black",Arial,sans-serif'; g.fillText('AMBULANCE',W/2,322);
  // 兩邊車柱頂：生命之星同直排細字
  drawStar(g,30,36,22); drawStar(g,W-30,36,22);
  g.font='bold 19px sans-serif'; ['救','護','車'].forEach((ch,i)=>g.fillText(ch,30,76+i*22)); ['勿','駛','近'].forEach((ch,i)=>g.fillText(ch,W-30,76+i*22));
  // 兩扇門：酒紅色圓角長窗、反光、黑色膠邊
  const rr=(x,y,w,h,r)=>{ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); };
  const win=(x)=>{ const w=96,h=190,y=58,r=46; rr(x-w/2-5,y-5,w+10,h+10,r+5); g.fillStyle='#1d1f24'; g.fill();
    const gr=g.createLinearGradient(0,y,0,y+h); gr.addColorStop(0,'#8a3a48'); gr.addColorStop(1,'#4a1720'); rr(x-w/2,y,w,h,r); g.fillStyle=gr; g.fill();
    g.fillStyle='rgba(255,255,255,.16)'; g.beginPath(); g.moveTo(x-w/2+12,y+40); g.lineTo(x-w/2+36,y+24); g.lineTo(x-w/2+36,y+h-50); g.lineTo(x-w/2+12,y+h-34); g.fill(); };
  win(180); win(420);
  g.fillStyle=RED; g.font='bold 24px sans-serif'; g.fillText(CALLSIGN,180,272); g.fillText(CALLSIGN,420,272);
  // KEEP CLEAR 黃底框
  g.fillStyle=YEL; g.fillRect(118,430,364,70); g.strokeStyle=RED; g.lineWidth=4; g.strokeRect(118,430,364,70);
  g.fillStyle=RED; g.font='900 52px "Arial Black",Arial,sans-serif'; g.fillText('KEEP CLEAR',W/2,467);
  // 門縫、鉸、門把、底部踏板
  g.strokeStyle='rgba(60,50,0,.55)'; g.lineWidth=3; g.strokeRect(60,40,480,540); g.beginPath(); g.moveTo(W/2,40); g.lineTo(W/2,580); g.stroke();
  g.fillStyle='#3a3d44'; [[62,90],[62,290],[62,500],[W-70,90],[W-70,290],[W-70,500]].forEach(([x,y])=>g.fillRect(x,y,8,34));
  g.fillStyle='#8d939c'; g.fillRect(W/2-36,374,22,48); g.fillRect(W/2+14,374,22,48); g.fillStyle='#5d636c'; g.fillRect(W/2-33,380,16,6); g.fillRect(W/2+17,380,16,6);
  g.fillStyle='#24262b'; g.fillRect(0,586,W,34); g.fillStyle='#3a3d44'; for(let x=10;x<W;x+=24) g.fillRect(x,590,14,4);
  const interior=(x0,y0,x1,y1)=>{ const w=x1-x0, h=y1-y0; g.fillStyle='#4a5260'; g.fillRect(x0,y0,w,h); g.fillStyle='#d9dde3'; g.fillRect(x0+w*0.04,y0+h*0.8,w*0.92,h*0.17); g.fillStyle='#6f7884'; g.fillRect(x0+w*0.04,y0+h*0.04,w*0.92,h*0.06);
    g.fillStyle='#c94a4a'; g.fillRect(x0+w*0.42,y0+h*0.48,w*0.16,h*0.28); g.fillStyle='#e6e9ee'; g.fillRect(x0+w*0.1,y0+h*0.15,w*0.25,h*0.55); g.fillRect(x0+w*0.65,y0+h*0.15,w*0.25,h*0.55); };
  if(body) interior(60,40,540,580);
  // 有相就用相：黃色原色；白色塗裝將黃色轉白（紅色人字保留）；之後寫返自己車號
  const num=CALLSIGN;
  c.__photo=()=>{ g.setTransform(S2,0,0,S2,0,0); g.drawImage(REAR_PHOTO,0,0,W,H);
    if(base!=='#ffe500'){ const d=g.getImageData(0,0,c.width,c.height), a=d.data; for(let i=0;i<a.length;i+=4){ const r=a[i],gg=a[i+1],b=a[i+2], y=(r+gg)/2; if(r>110&&gg>110&&b<y*0.62&&Math.abs(r-gg)<60){ const L=Math.min(1.08,y/225); a[i]=Math.min(255,244*L); a[i+1]=Math.min(255,246*L); a[i+2]=Math.min(255,249*L); } } g.putImageData(d,0,0); }
    g.fillStyle='#1b3a8c'; g.font='bold 21px Arial,sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(num,220,249); g.fillText(num,394,249);
    if(body){ const D=REAR_DOOR; interior(D.x0+4,D.y0+4,D.x1-4,D.y1-4); } };
  if(REAR_PHOTO_OK) c.__photo();
  return c;
}
function roofTex(base='#ffe500'){
  // 車頂（闊 2.7 × 長 4.9）：canvas 上方 = 車頭
  const W=270,H=490,c=document.createElement('canvas'); c.width=W; c.height=H; const g=c.getContext('2d');
  g.fillStyle=base; g.fillRect(0,0,W,H);
  // 邊緣紅藍線（跟車身斜紋延續）
  g.fillStyle='#e8202a'; g.fillRect(6,0,12,H); g.fillStyle='#1f4fbf'; g.fillRect(W-18,0,12,H);
  g.fillStyle='#1f4fbf'; g.fillRect(6,H-20,W-12,8); g.fillStyle='#e8202a'; g.fillRect(6,H-34,W-12,8);
  // 大生命之星（近車尾）
  drawStar(g,W/2,H-100,70);
  // 大車號（沿車身長度）
  g.save(); g.translate(W/2,H*0.44); g.rotate(Math.PI/2); g.fillStyle='#1f4fbf'; g.font='bold 92px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(CALLSIGN,0,0); g.restore();
  const t=new THREE.CanvasTexture(c); t.anisotropy=8; return t;
}
function liveryTex(frontRight,classic){
  // 車身側面貼紙：紅藍斜紋、生命之星、文字。長 7.05 × 高 3.1（每單位 160px）
  const PX=160, W=Math.round(7.05*PX), H=Math.round(3.1*PX);
  const c=document.createElement('canvas'); c.width=W; c.height=H; const g=c.getContext('2d');
  const X=x=>frontRight?x:W-x;
  const band=(pts,col,wd)=>{ g.strokeStyle=col; g.lineWidth=wd; g.lineJoin='round'; g.beginPath(); pts.forEach(([x,y],i)=>i?g.lineTo(X(x),y):g.moveTo(X(x),y)); g.stroke(); };
  if(classic){ // 經典白色：紅黃紅斜紋由車頭低位斜上車尾
    const P=(dy)=>[[W+10,404+dy],[720,404+dy],[470,190+dy],[-10,190+dy]];
    band(P(0),'#e8202a',46); band(P(-44),'#ffd400',40); band(P(-84),'#e8202a',34);
    drawStar(g,X(215),350,84);
    g.textAlign='center'; g.textBaseline='middle'; g.fillStyle='#1f4fbf';
    g.font='bold 46px sans-serif'; g.fillText('AMBULANCE',X(520),458); g.font='bold 40px sans-serif'; g.fillText('救護',X(820),300);
    g.font='bold 40px sans-serif'; g.fillText(CALLSIGN,X(800),110);
    g.fillStyle='#3c4656'; g.fillRect(frontRight?640:W-640-80,70,80,70);
    g.strokeStyle='rgba(120,120,120,.6)'; g.lineWidth=4; g.strokeRect(frontRight?620:W-620-110,170,110,230);
    const t=new THREE.CanvasTexture(c); t.anisotropy=8; return t; }
  // 紅帶（上）同藍帶（下），喺側門前斜落車頭
  band([[150,218],[620,218],[770,330],[W+10,330]],'#e8202a',34);
  band([[150,270],[600,270],[740,374],[W+10,374]],'#1f4fbf',34);
  band([[150,244],[610,244],[755,352],[W+10,352]],'#ffd400',10);
  drawStar(g,X(118),230,100);
  // 文字
  g.textAlign='center'; g.textBaseline='middle';
  g.fillStyle='#1c1c1c'; g.font='bold 30px sans-serif'; g.fillText('消防處救護車',X(470),219);
  g.fillStyle='#ffffff'; g.font='bold 20px sans-serif'; g.fillText('FIRE SERVICES AMBULANCE',X(420),271);
  g.fillStyle='#e8202a'; g.font='bold 40px sans-serif'; g.fillText('AMBULANCE',X(420),330); g.font='bold 44px sans-serif'; g.fillText('救護',X(420),382);
  g.fillStyle='#1f4fbf'; g.font='bold 40px sans-serif'; g.fillText(CALLSIGN,X(780),110);
  // 車廂小窗
  g.fillStyle='#3c4656'; g.fillRect(frontRight?640:W-640-80,70,80,70);
  // 側門輪廓
  g.strokeStyle='rgba(120,120,90,.7)'; g.lineWidth=4; g.strokeRect(frontRight?620:W-620-110,170,110,230);
  const t=new THREE.CanvasTexture(c); t.anisotropy=8; return t;
}
let CALLSIGN='A188';
function ambulance(num){ CALLSIGN=num||'A188';
  const g=new THREE.Group(); scene.add(g);
  const body=new THREE.Group(); g.add(body); // 車頭 = +z
  const Y=M(0xffe500,{r:0.45,e:0x3a3300}), gl=M(C.glass,{r:0.15}), dk=M(C.dark), red=M(C.red), grey=M(0xb8bcc2);
  add(rbox(3.0,3.1,5.4,0.4),Y,body,0,2.15,-0.7);              // 車廂（方箱）
  add(rbox(2.85,2.5,0.9,0.35),Y,body,0,1.85,2.45);            // 駕駛室
  add(rbox(2.85,1.35,0.9,0.35),Y,body,0,1.28,3.2);            // 車頭（較矮）
  const ws=add(new THREE.BoxGeometry(2.45,1.0,0.08),gl,body,0,2.55,2.95,false); ws.rotation.x=-0.45;
  add(rbox(2.95,0.45,0.35,0.15),dk,body,0,0.8,3.62);          // 黑色前泵把
  add(rbox(3.02,0.5,0.6,0.15),Y,body,0,0.85,-3.4);            // 後泵把（同車身色，跟真車）
  [-0.95,0.95].forEach(x=>add(sph(0.2),M(0xfff6c4,{e:0x554400}),body,x,1.55,3.65,false));
  // 車頭紅藍帶、引擎蓋生命之星、車廂頂「AMBULANCE」藍牌
  add(new THREE.BoxGeometry(2.7,0.12,0.04),M(0xe8202a),body,0,1.93,3.66,false);
  add(new THREE.BoxGeometry(2.7,0.12,0.04),M(0x1f4fbf),body,0,1.8,3.66,false);
  { const c=document.createElement('canvas'); c.width=128; c.height=128; const g2=c.getContext('2d'); drawStar(g2,64,64,56);
    const st=new THREE.Mesh(new THREE.PlaneGeometry(0.55,0.55),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true}));
    st.rotation.x=-Math.PI/2; st.position.set(0,1.97,3.25); body.add(st); }
  { const c=document.createElement('canvas'); c.width=512; c.height=96; const g2=c.getContext('2d');
    g2.fillStyle='#1f4fbf'; g2.fillRect(0,0,512,96); g2.strokeStyle='#ffffff'; g2.lineWidth=6; g2.strokeRect(8,8,496,80);
    g2.fillStyle='#ffffff'; g2.font='bold 62px sans-serif'; g2.textAlign='center'; g2.textBaseline='middle'; g2.fillText('AMBULANCE',256,50);
    const sg=new THREE.Mesh(new THREE.PlaneGeometry(2.0,0.38),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c)}));
    sg.position.set(0,3.42,2.03); body.add(sg); }
  const SK={sides:[],doors:[]}; const myNum=CALLSIGN;
  { const rf=SK.roof=new THREE.Mesh(new THREE.PlaneGeometry(2.7,4.9),new THREE.MeshStandardMaterial({map:roofTex(),roughness:0.5}));
    rf.rotation.x=-Math.PI/2; rf.rotation.z=Math.PI; rf.position.set(0,3.71,-0.7); body.add(rf); }
  [-1,1].forEach(sx=>{
    add(rbox(0.12,0.45,0.25,0.05),dk,body,sx*1.62,2.35,2.95,false); add(new THREE.BoxGeometry(0.25,0.05,0.05),dk,body,sx*1.52,2.35,2.95,false);
    add(new THREE.BoxGeometry(0.05,0.8,0.75),gl,body,sx*1.44,2.4,2.5,false);           // 側窗
    const p=new THREE.Mesh(new THREE.PlaneGeometry(7.05,3.1),new THREE.MeshStandardMaterial({map:liveryTex(sx<0),transparent:true,roughness:0.5}));
    p.position.set(sx*1.53,2.15,0.125); p.rotation.y=sx*Math.PI/2; body.add(p); SK.sides.push([p,sx<0]);
  });
  // 藍色警示燈：車頂四角 + 前燈架
  const blues=[];
  [[-1.2,3.75,-3.2],[1.2,3.75,-3.2],[-1.2,3.75,1.7],[1.2,3.75,1.7]].forEach(([x,y,z],i)=>blues.push(add(rbox(0.5,0.18,0.3,0.06),M(0x2f6bff),body,x,y,z,false)));
  blues.push(add(rbox(0.32,0.3,0.12,0.05),M(0x2f6bff),body,-1.25,3.42,2.04,false), add(rbox(0.32,0.3,0.12,0.05),M(0x2f6bff),body,1.25,3.42,2.04,false));
  const pB=new THREE.PointLight(0x3a88ff,0,11), pR=new THREE.PointLight(0x3a88ff,0,11); pB.position.set(-1,4.2,0); pR.position.set(1,4.2,0); body.add(pB,pR);
  // 車輪
  const wheels=[]; [[-1.42,2.6],[1.42,2.6],[-1.42,-2.3],[1.42,-2.3]].forEach(([x,z])=>{
    const w=add(cyl(0.6,0.6,0.48),dk,body,x,0.6,z); w.rotation.z=Math.PI/2; add(cyl(0.3,0.3,0.5),grey,w,0,0,0,false); wheels.push(w);});
  // 尾門 + 紅黃人字反光
  const REAR=rearTex(false), REARB=rearTex(true);
  { const bp=SK.bp=new THREE.Mesh(new THREE.PlaneGeometry(3.0,3.1),new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(REARB),roughness:0.5}));
    bp.rotation.y=Math.PI; bp.position.set(0,2.15,-3.405); body.add(bp); }
  const DW=0.92, DH=2.32, DY=2.375, doorTex=(cv,s)=>{ const D=REAR_DOOR, tx=new THREE.CanvasTexture(cv); tx.anisotropy=8; tx.repeat.set((D.xm-D.x0)/600,(D.y1-D.y0)/620); tx.offset.set((s>0?D.x0:D.xm)/600,1-D.y1/620); return tx; };
  const doors=[]; [-1,1].forEach(s=>{ const hinge=new THREE.Group(); hinge.position.set(s*DW,0,-3.43); body.add(hinge);
    const d=add(new THREE.BoxGeometry(DW,DH,0.06),Y,hinge,-s*DW/2,DY,0);
    const tx=doorTex(REAR,s);
    const dp=new THREE.Mesh(new THREE.PlaneGeometry(DW,DH),new THREE.MeshStandardMaterial({map:tx,roughness:0.5})); dp.rotation.y=Math.PI; dp.position.z=-0.035; d.add(dp); SK.doors.push([dp,s]);
    hinge.userData.s=s; doors.push(hinge); });
  // 尾燈（紅＋琥珀，直排）、車牌、踏板
  const LT={tail:[],ind:{}};
  [-1,1].forEach(s=>{ LT.tail.push(add(rbox(0.22,0.34,0.1,0.04),M(0xe8202a,{e:0x400000}),body,s*1.36,1.32,-3.43,false));
    LT.ind[s]=[add(rbox(0.22,0.2,0.1,0.04),M(0xffa31a,{e:0x402000}),body,s*1.36,1.02,-3.43,false)];
    add(rbox(0.22,0.14,0.1,0.04),M(0xffffff),body,s*1.36,0.82,-3.43,false); });
  { const c=document.createElement('canvas'); c.width=256; c.height=64; const g2=c.getContext('2d'); g2.fillStyle='#ffd400'; g2.fillRect(0,0,256,64); g2.strokeStyle='#111'; g2.lineWidth=4; g2.strokeRect(3,3,250,58);
    g2.fillStyle='#111'; g2.font='bold 44px sans-serif'; g2.textAlign='center'; g2.textBaseline='middle'; g2.fillText(CALLSIGN.replace(/^([A-Z]+)(\d)/,'$1 $2'),128,34);
    const pl=new THREE.Mesh(new THREE.PlaneGeometry(0.9,0.23),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c)})); pl.rotation.y=Math.PI; pl.position.set(0,0.85,-3.72); body.add(pl); }
  add(new THREE.BoxGeometry(1.6,0.08,0.35),M(0x8a8f97),body,0,0.62,-3.75,false);
  // 車頂設備：冷氣機、天窗、天線、尾部藍燈
  add(rbox(1.3,0.26,0.6,0.1),M(0xe9ecef),body,0,3.83,1.4);
  add(cyl(0.03,0.03,0.7,6),M(0x2b2d33),body,0.9,4.05,1.6,false);
  add(cyl(0.03,0.03,0.5,6),M(0x2b2d33),body,-0.9,3.95,-2.6,false);
  blues.push(add(rbox(0.4,0.18,0.18,0.05),M(0x2f6bff),body,-0.9,3.55,-3.47,false), add(rbox(0.4,0.18,0.18,0.05),M(0x2f6bff),body,0.9,3.55,-3.47,false));
  add(rbox(0.3,0.16,0.16,0.05),M(0xffa31a,{e:0x402000}),body,0,3.6,-3.47,false);
  // 換塗裝（黃／經典白）：第一次用先生成貼圖
  const TS={}; const texSet=(cl)=>{ if(TS[cl]) return TS[cl]; CALLSIGN=myNum; const base=cl?'#f4f6f8':'#ffe500';
    const R=rearTex(false,base), RB=rearTex(true,base);
    const dt=s=>doorTex(R,s);
    return TS[cl]={roof:roofTex(base),bp:new THREE.CanvasTexture(RB),side:{true:liveryTex(true,cl),false:liveryTex(false,cl)},door:{'1':dt(1),'-1':dt(-1)}}; };
  const setClassic=(cl)=>{ cl=!!cl; if(!cl&&!TS[true]&&!TS[false]) return; const T=texSet(cl); const put=(mesh,t)=>{ mesh.material.map=t; mesh.material.needsUpdate=true; };
    put(SK.roof,T.roof); put(SK.bp,T.bp); SK.sides.forEach(([p,f])=>put(p,T.side[f])); SK.doors.forEach(([p,s])=>put(p,T.door[s])); };
  // 夜間照明射燈：車尾同左右兩邊車頂附近（白色），地面有柔和光
  const FL={lamps:[],glow:[]};
  { const lm=M(0xf4f6f8,{e:0}); [[-1.25,3.32,-3.47,0],[1.25,3.32,-3.47,0],[1.52,3.32,-2.2,1],[1.52,3.32,0.4,1],[-1.52,3.32,-2.2,1],[-1.52,3.32,0.4,1]].forEach(([x,y,z,sd])=>{ const b=add(rbox(sd?0.08:0.34,0.16,sd?0.34:0.08,0.03),lm,body,x,y,z,false); FL.lamps.push(b); }); FL.mat=lm;
    const c=document.createElement('canvas'); c.width=c.height=128; const g2=c.getContext('2d'); const rg=g2.createRadialGradient(64,64,4,64,64,64); rg.addColorStop(0,'rgba(255,255,255,.85)'); rg.addColorStop(0.5,'rgba(255,255,255,.3)'); rg.addColorStop(1,'rgba(255,255,255,0)'); g2.fillStyle=rg; g2.fillRect(0,0,128,128);
    const gm=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,color:0xf2f6ff,opacity:0.38,polygonOffset:true,polygonOffsetFactor:-5,polygonOffsetUnits:-5}); FL.gmat=gm;
    [[0,-7.2,8,7],[5.4,-0.8,6,10],[-5.4,-0.8,6,10]].forEach(([x,z,w,l])=>{ const q=new THREE.Mesh(new THREE.PlaneGeometry(w,l),gm); q.rotation.x=-Math.PI/2; q.position.set(x,0.3,z); q.renderOrder=3; q.visible=false; body.add(q); FL.glow.push(q); }); }
  // 車頭轉向燈（前角）
  [-1,1].forEach(s=>LT.ind[s].push(add(rbox(0.16,0.14,0.12,0.03),M(0xffa31a,{e:0x402000}),body,s*1.25,1.32,3.62,false)));
  g.userData={body,doors,wheels,blues,pB,pR,lb:blues[4],lr:blues[5],setClassic,LT,FL};
  return g;
}
/* ---------- Q 版救護員（橙色風褸） ---------- */
function person(kind){
  const g=new THREE.Group();
  const jacket=kind==='crew'?M(C.jacket):M(kind==='bystander'?0x7ec8e3:0xa78bfa), refl=M(C.reflect,{e:0x333333,r:0.3}), legs=M(kind==='crew'?C.navy:0x50586a);
  add(cyl(0.45,0.52,1.05),jacket,g,0,1.07,0);
  if(kind==='crew'){ add(cyl(0.465,0.49,0.1),refl,g,0,0.9,0,false); add(cyl(0.455,0.475,0.1),refl,g,0,1.25,0,false); add(cyl(0.2,0.2,0.18),jacket,g,0,1.62,0); }
  add(sph(0.64),M(C.skin),g,0,2.1,0);
  const hair=add(sph(0.67),M(C.hair),g,0,2.24,-0.07); hair.scale.set(1,0.86,1);   // 頭髮要高過個頭頂（2.74），唔係會露出膚色似禿頭
  if(kind==='crew'){ // 藍色 cap 帽：帽頂＋帽舌
    const capM=M(0x1f4fbf,{r:0.6}); const top=add(new THREE.SphereGeometry(0.71,20,10,0,Math.PI*2,0,Math.PI/2),capM,g,0,2.3,-0.04); top.scale.set(1,0.82,1);   // 帽頂約 2.88，蓋過頭頂
    add(new THREE.CylinderGeometry(0.7,0.7,0.1,20),capM,g,0,2.31,-0.04);
    const brim=add(new THREE.CylinderGeometry(0.42,0.42,0.06,16,1,false,-Math.PI/2,Math.PI),M(0x183f99,{r:0.6}),g,0,2.36,0.4,false); brim.scale.set(1.1,1,0.8); }
  [-0.21,0.21].forEach(x=>add(sph(0.08),M(0x22252b),g,x,2.15,0.58,false));
  [-0.34,0.34].forEach(x=>add(sph(0.085),M(0xff9aa2),g,x,1.99,0.52,false));
  const arms=[-0.6,0.6].map(x=>{const a=add(cyl(0.13,0.13,0.8),jacket,g,x,1.18,0.12); if(kind==='crew') add(cyl(0.14,0.14,0.08),refl,a,0,-0.15,0,false); a.rotation.x=-0.8; return a;});
  const legL=add(cyl(0.15,0.15,0.6),legs,g,-0.21,0.3,0), legR=add(cyl(0.15,0.15,0.6),legs,g,0.21,0.3,0);
  [legL,legR].forEach(l=>add(sph(0.17),M(0x1f2328),l,0,-0.3,0.06,false));
  g.userData={legL,legR,arms}; return g;
}
function stretcherSet(){
  const g=new THREE.Group(); scene.add(g);
  const st=new THREE.Group(); g.add(st);
  const fr=M(0xc9d1da), mat=M(0xff9f1c), dk=M(C.dark);
  add(rbox(1.2,0.16,3.2,0.07),fr,st,0,1.0,0); add(rbox(1.1,0.22,3.0,0.1),mat,st,0,1.18,0);
  [[-0.45,1.2],[0.45,1.2],[-0.45,-1.2],[0.45,-1.2]].forEach(([x,z])=>{add(cyl(0.05,0.05,0.9),fr,st,x,0.5,z);add(sph(0.14),dk,st,x,0.12,z);});
  const c1=person('crew'), c2=person('crew'); c1.position.z=2.3; c1.rotation.y=Math.PI; c2.position.z=-2.3; g.add(c1,c2);
  g.userData={st,c1,c2}; g.visible=false; return g;
}
function lyingPatient(){
  const g=new THREE.Group(); scene.add(g);
  const p=person('patient'); p.rotation.x=-Math.PI/2; p.position.set(0,0.5,1.2); g.add(p);
  const blanket=add(rbox(1.1,0.35,1.9,0.15),M(0xb9e3ff),g,0,0.62,0.4); blanket.visible=false; g.userData={blanket,p}; return g;
}



let seed=20261108; const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647; const pick=a=>a[rnd()*a.length|0];

/* ---------- 貼圖 ---------- */
function canvasTex(w,h,draw,rep=true){ const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c); if(rep){t.wrapS=t.wrapT=THREE.RepeatWrapping;} t.anisotropy=4; return t; }
const rr=(g,x,y,w,h,r)=>{g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();};
// 屋邨：一格 = 一層兩個單位（闊 8 米、高 3 米）
function housingTex(wall,trim,k0=0){ return canvasTex(256,96,(g,w,h)=>{
  g.fillStyle=wall; g.fillRect(0,0,w,h); g.fillStyle=trim; g.fillRect(0,h-8,w,8);
  for(let k=0;k<2;k++){ const x=k*128+22;
    g.fillStyle='#ffffff'; rr(g,x-4,16,88,52,8); g.fill();
    g.fillStyle=['#7fb3d5','#9cc9e6','#ffe6a3','#8fc1e3'][(k+k0)%4]; rr(g,x,20,80,44,6); g.fill();
    g.fillStyle='rgba(255,255,255,.55)'; g.fillRect(x+38,20,4,44);
    if(k===0){ g.fillStyle='#d9dde3'; rr(g,x+58,70,26,16,3); g.fill(); g.fillStyle='#aeb5bf'; g.fillRect(x+62,74,18,2); g.fillRect(x+62,79,18,2);} // 冷氣機
  } }); }
// 唐樓：露台、晾衫
function tongTex(wall,k0){ return canvasTex(256,96,(g,w,h)=>{
  g.fillStyle=wall; g.fillRect(0,0,w,h);
  for(let k=0;k<3;k++){ const x=k*85+10; g.fillStyle='#5b6b7d'; g.fillRect(x,18,62,46); g.fillStyle='#a8c6dc'; g.fillRect(x+4,22,54,38);
    g.fillStyle='rgba(0,0,0,.25)'; g.fillRect(x+29,22,3,38); g.fillStyle='#e9e2d4'; g.fillRect(x-4,64,70,6);
    if((k+k0)%2){ ['#ff8fab','#8fd3ff','#ffd166','#b8f2a8'].forEach((c,q)=>{g.fillStyle=c; g.fillRect(x+6+q*14,66,8,14);}); } }
  g.fillStyle='rgba(0,0,0,.12)'; g.fillRect(0,h-4,w,4); }); }
// 地舖：一格 = 4 間舖（闊 24 米、高 4.5 米）
const SHOPS=['茶餐廳','藥房','麵包店','便利店','涼茶','文具','時裝','眼鏡','五金','海味','燒味','髮型屋','電器','車仔麵','金行','花店','書局','糖水','士多','雜貨'];
const SCOL=['#e63946','#2a9d8f','#f4a261','#457b9d','#e76f51','#6a4c93','#2b9348','#d62828','#0077b6','#ff006e'];
function shopTex(){ return canvasTex(512,96,(g,w,h)=>{
  g.fillStyle='#f3efe6'; g.fillRect(0,0,w,h);
  for(let k=0;k<4;k++){ const x=k*128; const col=pick(SCOL);
    g.fillStyle=col; g.fillRect(x+4,4,120,26); g.fillStyle='#fff'; g.font='bold 20px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(pick(SHOPS),x+64,18);
    for(let s=0;s<8;s++){ g.fillStyle=s%2?'#ffffff':col; g.fillRect(x+4+s*15,32,15,10); } // 雨篷
    if(rnd()<0.75){ g.fillStyle='#bfe3f2'; g.fillRect(x+12,44,104,46); g.fillStyle='rgba(255,255,255,.6)'; g.fillRect(x+20,48,8,38);
      g.fillStyle=pick(['#ffd166','#ff8fab','#8ecae6','#cdb4db']); g.fillRect(x+36,70,30,20); g.fillRect(x+74,64,26,26); }
    else { g.fillStyle='#b8bec6'; g.fillRect(x+12,44,104,46); g.fillStyle='#9aa1aa'; for(let q=0;q<10;q++) g.fillRect(x+12,46+q*4.6,104,1.5); } // 閘
  } }); }
const MAT={}; function texMat(key,tex){ if(!MAT[key]) MAT[key]=new THREE.MeshStandardMaterial({map:tex,roughness:0.8}); return MAT[key]; }
const HOUSING=[['#ffd6e0','#ff8fab'],['#d3f5e8','#52b788'],['#d8ecff','#5aa9e6'],['#fff2c6','#f4a261'],['#eadcff','#9d4edd'],['#ffe5d1','#f77f00']];
const housingMats=HOUSING.map((p,k)=>texMat('h'+k,housingTex(p[0],p[1],k)));
const tongMats=['#f2e3c9','#e8d5d5','#d9e4d0','#f0d9b5'].map((c,k)=>texMat('t'+k,tongTex(c,k)));
const shopMats=[0,1,2,3,4,5].map(k=>texMat('s'+k,shopTex()));
const roofMat=new THREE.MeshStandardMaterial({color:0xa9b0ba,roughness:0.9});
// 天台：有地磚格、矮牆、通風口，幾種顏色
const roofMats=[['#c9b8a6','#a8947f'],['#b9c6cf','#8fa2b0'],['#c7d1b3','#9fae86'],['#d8c3c3','#b39494'],['#cfc6e0','#a49abf']].map(([a,b],k)=>texMat('roof'+k,canvasTex(128,128,(g,w,h)=>{
  g.fillStyle=a; g.fillRect(0,0,w,h); g.strokeStyle=b; g.lineWidth=2; for(let q=0;q<=w;q+=16){ g.beginPath(); g.moveTo(q,0); g.lineTo(q,h); g.stroke(); g.beginPath(); g.moveTo(0,q); g.lineTo(w,q); g.stroke(); }
  g.fillStyle='rgba(255,255,255,.55)'; g.fillRect(20+k*8,30,22,22); g.fillStyle='rgba(0,0,0,.18)'; g.fillRect(80,76-k*6,18,30); })));
const walkTex=canvasTex(64,64,(g,w,h)=>{ g.fillStyle='#c9c0b0'; g.fillRect(0,0,w,h); g.strokeStyle='#a99c86'; g.lineWidth=2; g.strokeRect(1,1,31,31); g.strokeRect(33,1,30,31); g.strokeRect(1,33,31,30); g.strokeRect(33,33,30,30); g.fillStyle='#bdb19c'; g.fillRect(34,34,28,28); });
const walkMat=new THREE.MeshStandardMaterial({map:walkTex,roughness:0.9}), lotMat=M(0xcfc3ab,{r:0.95}), grassMat=M(0x78c255,{r:0.95}), podMat=M(0x82c766,{r:0.95}), alleyMat=M(0xbcb6a8,{r:0.95});

/* ---------- 畫面質素（0 標準、1 精細、2 超精細）：要重新載入地圖先生效 ---------- */
const GFX=(()=>{ try{ const v=+JSON.parse(localStorage.getItem('a188.gfx')||'2'); return v>=3?3:v>=2?2:v>=1?1:0; }catch(e){ return 0; } })();
// 細節專用亂數（唔郁到城市本身嘅 rnd，所以三個模式嘅街道同樓宇位置一樣）
let _ds=7919; const drnd=()=>{ _ds=(_ds*1664525+1013904223)>>>0; return _ds/4294967296; }; const dpick=a=>a[drnd()*a.length|0];
const DFRONT=[]; window.__DF=DFRONT;   // 沿街樓宇門面：{c,type,h}
/* ----- 精細模式：更多款舖頭門面（自創舖名，唔用真實品牌） ----- */
if(GFX){
  const PRE=['新記','合興','永利','祥興','華豐','大華','好運','鴻運','金城','百樂','東興','福來','利源','裕泰','恆昌','德記','發記','明記','寶華','美華'];
  const KINDS=[
    ['茶餐廳','food','#1f7a4d'],['冰室','food','#2a9d8f'],['粥麵','food','#c1121f'],['車仔麵','food','#e85d04'],['糖水','food','#c9184a'],
    ['燒味','roast','#b5179e'],['燒臘飯店','roast','#9d0208'],
    ['大藥房','pharm','#0077b6'],['便利店','pharm','#2b9348'],['士多','pharm','#e76f51'],['文具','pharm','#6a4c93'],
    ['金行','gold','#b8860b'],['珠寶','gold','#9d0208'],['錶行','gold','#3a0ca3'],
    ['地產','estate','#1d4e89'],['找換','estate','#386641'],
    ['生果','fruit','#e85d04'],['海味','fruit','#7f4f24'],['花店','fruit','#d81159'],
    ['五金','hw','#495057'],['電器','hw','#023e8a'],['眼鏡','hw','#0081a7'],
    ['髮型屋','barber','#ef476f'],['涼茶','food','#432818'],['中醫','pharm','#6b4226'],['麵包西餅','food','#bc6c25']];
  const font=(g,t,w,px)=>{ let s=px; g.font='bold '+s+'px sans-serif'; while(g.measureText(t).width>w&&s>12){ s-=2; g.font='bold '+s+'px sans-serif'; } };
  function front(g,x,W,H,kind){ const [nm,tp,col]=kind, name=dpick(PRE)+nm;
    // 招牌（成條，凸邊）
    g.fillStyle='#2b2b2b'; g.fillRect(x+2,2,W-4,52); g.fillStyle=col; g.fillRect(x+5,5,W-10,46);
    g.fillStyle='rgba(255,255,255,.18)'; g.fillRect(x+5,5,W-10,8);
    g.fillStyle=tp==='gold'?'#ffe066':'#ffffff'; g.textAlign='center'; g.textBaseline='middle'; font(g,name,W-24,34); g.fillText(name,x+W/2,30);
    // 柱同門框
    g.fillStyle='#d8d2c4'; g.fillRect(x,56,8,H-56); g.fillRect(x+W-8,56,8,H-56);
    const fx=x+10, fy=60, fw=W-20, fh=H-62;
    if(drnd()<0.12){ // 落咗閘
      g.fillStyle='#aab1ba'; g.fillRect(fx,fy,fw,fh); g.fillStyle='#8d949d'; for(let q=0;q<fh;q+=6) g.fillRect(fx,fy+q,fw,2); return; }
    const glass=(c)=>{ g.fillStyle=c; g.fillRect(fx,fy,fw,fh); };
    if(tp==='food'){ glass('#ffe9c2'); g.fillStyle='#c8553d'; for(let k=0;k<4;k++) g.fillRect(fx+8+k*(fw-16)/4,fy+8,(fw-16)/4-8,26);   // 牆上餐牌
      g.fillStyle='#fff'; for(let k=0;k<4;k++) for(let l=0;l<3;l++) g.fillRect(fx+12+k*(fw-16)/4,fy+12+l*7,(fw-16)/4-16,3);
      g.fillStyle='#6b4f3a'; for(let k=0;k<3;k++){ const tx=fx+20+k*(fw-40)/3; g.fillRect(tx,fy+fh-42,40,6); g.fillRect(tx+18,fy+fh-36,4,30); }
      g.fillStyle='#ffd166'; for(let k=0;k<3;k++){ g.beginPath(); g.arc(fx+40+k*(fw-60)/3,fy+44,7,0,6.3); g.fill(); } }
    else if(tp==='roast'){ glass('#ffd7a8'); g.fillStyle='#8a4b2a'; g.fillRect(fx,fy+8,fw,4);
      for(let k=0;k<6;k++){ const hx=fx+16+k*(fw-30)/6; g.fillStyle='#a0522d'; g.beginPath(); g.ellipse(hx+10,fy+40,11,22,0,0,6.3); g.fill(); g.fillStyle='#d2691e'; g.beginPath(); g.ellipse(hx+8,fy+36,6,12,0,0,6.3); g.fill(); g.fillStyle='#555'; g.fillRect(hx+9,fy+10,2,10); }
      g.fillStyle='#c0392b'; g.fillRect(fx,fy+fh-30,fw,30); g.fillStyle='#e9e9e9'; g.fillRect(fx+6,fy+fh-24,fw-12,6); }
    else if(tp==='pharm'){ glass('#f4fbff'); const cs=['#e63946','#2a9d8f','#ffb703','#457b9d','#f72585','#06d6a0','#8338ec'];
      for(let r=0;r<5;r++) for(let k=0;k<fw/12-1;k++){ g.fillStyle=cs[(r*3+k)%cs.length]; g.fillRect(fx+6+k*12,fy+8+r*22,9,14); }
      g.fillStyle='#cfd8dc'; for(let r=0;r<5;r++) g.fillRect(fx+4,fy+23+r*22,fw-8,2);
      if(kind[0].includes('藥')){ g.fillStyle='#e63946'; g.fillRect(fx+fw-34,fy+6,24,8); g.fillRect(fx+fw-26,fy-2,8,24); } }
    else if(tp==='gold'){ glass('#7a0b0b'); g.fillStyle='#ffd166'; for(let k=0;k<3;k++){ g.fillRect(fx+10+k*(fw-20)/3,fy+fh-46,(fw-20)/3-10,40); }
      g.fillStyle='#fff3b0'; for(let q=0;q<26;q++){ g.beginPath(); g.arc(fx+10+drnd()*(fw-20),fy+fh-40+drnd()*30,2.5,0,6.3); g.fill(); }
      g.fillStyle='#ffe066'; font(g,'足金',fw/2,30); g.fillText('足金',fx+fw/2,fy+28); }
    else if(tp==='estate'){ glass('#dbe9f6'); g.fillStyle='#fff'; for(let r=0;r<4;r++) for(let k=0;k<fw/30;k++){ g.fillRect(fx+6+k*30,fy+6+r*30,24,26); g.fillStyle='#e63946'; g.fillRect(fx+8+k*30,fy+9+r*30,14,4); g.fillStyle='#fff'; } }
    else if(tp==='fruit'){ glass('#5a4636'); const cs=nm==='海味'?['#c68b59','#8d5524','#e0a96d','#a0522d']:nm==='花店'?['#ff4d6d','#ffd60a','#c77dff','#ff8fab']:['#ff7b00','#e5383b','#ffd000','#70e000','#9d4edd'];
      for(let r=0;r<3;r++){ g.fillStyle='#8d6e4c'; g.fillRect(fx+4,fy+fh-24-r*28,fw-8,6); for(let k=0;k<fw/9-1;k++){ g.fillStyle=cs[(k+r)%cs.length]; g.beginPath(); g.arc(fx+10+k*9,fy+fh-30-r*28,4.5,0,6.3); g.fill(); } } }
    else if(tp==='hw'){ glass('#e9ecef'); for(let k=0;k<fw/28;k++){ g.fillStyle=nm==='電器'?'#222':'#6c757d'; g.fillRect(fx+6+k*28,fy+10,22,nm==='電器'?16:30); if(nm==='電器'){ g.fillStyle=dpick(['#4cc9f0','#f72585','#b5e48c']); g.fillRect(fx+8+k*28,fy+12,18,12); } }
      g.fillStyle='#adb5bd'; g.fillRect(fx,fy+fh-36,fw,36); }
    else if(tp==='barber'){ glass('#fde2e4'); for(let k=0;k<3;k++){ g.fillStyle='#333'; g.fillRect(fx+18+k*(fw-36)/3,fy+fh-50,26,40); }
      for(let q=0;q<10;q++){ g.fillStyle=q%3===0?'#e63946':q%3===1?'#fff':'#1d3557'; g.fillRect(fx+fw-16,fy+6+q*9,10,9); } }
    // 門口地台、玻璃反光
    g.fillStyle='rgba(255,255,255,.22)'; g.fillRect(fx+fw*0.62,fy,10,fh);
  }
  const mk=k=>texMat('sg'+k,canvasTex(1024,192,(g,w,h)=>{ g.fillStyle='#efe8da'; g.fillRect(0,0,w,h); for(let q=0;q<4;q++) front(g,q*256,256,h,KINDS[(k*4+q*7+(drnd()*3|0))%KINDS.length]); }));
  const n=GFX>=2?14:10; const nm=[]; for(let k=0;k<n;k++) nm.push(mk(k));
  for(let k=0;k<shopMats.length;k++) shopMats[k]=nm[k];   // 保持 pick(shopMats) 次數一樣（城市唔會變樣）
  shopMats.length=0; shopMats.push(...nm);
}

/* ---------- 🖥️ 電腦畫質（GFX 3）：GTA 式樓宇 ----------
   同一個佔地、同一套 rnd（原本嘅樓照計一次亂數但唔畫），所以街道同樓宇位置唔變；
   揀樓款、高度、天台細節全部用獨立亂數 pr()。 */
const PCB=(()=>{ if(GFX<3) return null;
  let ps=424243; const pr=()=>(ps=(ps*16807)%2147483647)/2147483647; const pp=a=>a[pr()*a.length|0]; const rng=(a,b)=>a+pr()*(b-a);
  const ANI=Math.min(8,R.capabilities.getMaxAnisotropy());
  const ALL=[];   // 所有電腦畫質材質（夜晚開窗燈）
  const ctex=(w,h,draw)=>{ const t=canvasTex(w,h,draw); t.anisotropy=ANI; return t; };
  // 每款外牆：map（日間）＋ em（夜晚窗燈），同一個 UV
  function facade(W,H,bays,floors,wall,win,litP,litCols,opt={}){
    const bw=W/bays, fh=H/floors, lit=[];
    for(let f=0;f<floors;f++){ const full=pr()<(opt.fullFloor||0.08), dark=pr()<0.12; for(let b=0;b<bays;b++) lit.push(full?1:dark?0:pr()<litP?1:0); }
    const map=ctex(W,H,g=>{ wall(g,W,H,bw,fh); for(let f=0;f<floors;f++) for(let b=0;b<bays;b++) win(g,b*bw,f*fh,bw,fh,lit[f*bays+b],f,b); if(opt.after) opt.after(g,W,H,bw,fh); });
    const em=ctex(W,H,g=>{ g.fillStyle='#000'; g.fillRect(0,0,W,H);
      for(let f=0;f<floors;f++) for(let b=0;b<bays;b++){ if(!lit[f*bays+b]) continue; const r=opt.winRect?opt.winRect(b*bw,f*fh,bw,fh):[b*bw+bw*0.12,f*fh+fh*0.18,bw*0.76,fh*0.6];
        const col=pp(litCols); const gr=g.createLinearGradient(0,r[1],0,r[1]+r[3]); gr.addColorStop(0,col); gr.addColorStop(1,'rgba(0,0,0,.55)'); g.fillStyle=col; g.fillRect(r[0],r[1],r[2],r[3]);
        g.fillStyle='rgba(0,0,0,'+(0.15+pr()*0.35)+')'; g.fillRect(r[0]+r[2]*pr()*0.6,r[1]+r[3]*0.35,r[2]*0.35,r[3]*0.65); }   // 窗後面有啲傢俬遮住
      if(opt.emAfter) opt.emAfter(g,W,H,bw,fh); });
    return {map,em}; }
  function mat(tx,o={}){ const m=new THREE.MeshStandardMaterial({map:tx.map,emissiveMap:tx.em,emissive:0x000000,roughness:o.r??0.82,metalness:o.m??0,envMapIntensity:o.env??0});
    m.userData.pc={glass:!!o.glass,emk:o.emk??1,env:o.env??0,us:o.us||12,vs:o.vs||24}; ALL.push(m); return m; }
  const WARM=['#ffd89a','#ffe2b0','#ffcf88','#fff0cc'], COOL=['#e6f2ff','#cfe6ff','#f4fbff'], MIX=['#ffd89a','#e6f2ff','#ffe2b0','#cfe6ff','#ffeec2'];
  /* ----- 玻璃幕牆寫字樓：4 格 × 8 層，每層 3.6 米 ----- */
  const GLASS=[['#2d5f7c','#8fc3dc','#24303a','#1f3b4d'],['#2f6b5a','#9fd3c0','#22302c','#20453b'],['#6b5a43','#d8c2a0','#2c2620','#4a3d2f'],['#4f5d6b','#c6d2dd','#2a3038','#38434f'],['#22344f','#7ea2d6','#1b2230','#1d2a40']].map(([base,hi,frame,spd])=>mat(facade(512,1024,4,8,
    (g,W,H)=>{ const gr=g.createLinearGradient(0,0,W*0.3,H); gr.addColorStop(0,hi); gr.addColorStop(0.45,base); gr.addColorStop(1,hi); g.fillStyle=gr; g.fillRect(0,0,W,H); },
    (g,x,y,w,h)=>{ g.fillStyle='rgba(255,255,255,'+(pr()*0.1)+')'; g.fillRect(x,y,w,h); if(pr()<0.25){ g.fillStyle='rgba(0,0,0,.12)'; g.fillRect(x,y,w,h); }
      g.fillStyle=spd; g.fillRect(x,y+h-16,w,16); g.fillStyle=frame; g.fillRect(x,y,4,h); g.fillRect(x+w/2-1,y,2,h-16); g.fillRect(x,y+h-17,w,3); },
    0.38,MIX,{fullFloor:0.14,winRect:(x,y,w,h)=>[x+4,y+4,w-6,h-22],after:(g,W,H)=>{ g.fillStyle='rgba(255,255,255,.07)'; g.beginPath(); g.moveTo(0,H*0.75); g.lineTo(W*0.7,0); g.lineTo(W,0); g.lineTo(0,H); g.fill(); }}),
    {r:0.12,m:0.75,env:1.15,glass:true,emk:1.1,us:12,vs:28.8}));
  /* ----- 私人住宅高樓：凸窗、冷氣機、窗框 ----- */
  const RESI=[['#efe9df','#c9bfae'],['#e8d8cf','#bfa79a'],['#dde2e6','#aab3bb'],['#e9dfc4','#c2b38c'],['#d9d4cc','#9e9688']].map(([w1,w2])=>mat(facade(512,1024,4,8,
    (g,W,H,bw,fh)=>{ g.fillStyle=w1; g.fillRect(0,0,W,H); g.fillStyle=w2; for(let b=0;b<4;b++) g.fillRect(b*bw+bw-10,0,10,H); for(let f=0;f<8;f++) g.fillRect(0,f*fh+fh-6,W,6);
      for(let i=0;i<260;i++){ g.fillStyle='rgba(60,50,40,'+(pr()*0.05)+')'; g.fillRect(pr()*W,pr()*H,2+pr()*6,8+pr()*40); } },
    (g,x,y,w,h,l,f,b)=>{ const bay=b%2===0; g.fillStyle='rgba(0,0,0,.16)'; if(bay) g.fillRect(x+w*0.1,y+h*0.12,w*0.8,h*0.72);
      g.fillStyle=l?'#5d6f80':'#4a5a6a'; g.fillRect(x+w*0.14,y+h*0.16,w*0.72,h*0.56); g.fillStyle='rgba(190,215,235,.35)'; g.fillRect(x+w*0.14,y+h*0.16,w*0.72,h*0.18);
      g.fillStyle='#f4f4f2'; g.fillRect(x+w*0.14,y+h*0.16,w*0.72,5); g.fillRect(x+w*0.49,y+h*0.16,5,h*0.56); g.fillRect(x+w*0.14,y+h*0.72-4,w*0.72,6);
      if(pr()<0.5){ g.fillStyle='#e9ecee'; g.fillRect(x+w*0.62,y+h*0.76,w*0.26,h*0.16); g.fillStyle='#9aa1a9'; g.fillRect(x+w*0.64,y+h*0.79,w*0.2,3); } },
    0.46,WARM,{winRect:(x,y,w,h)=>[x+w*0.16,y+h*0.18,w*0.68,h*0.52]}),{r:0.8,emk:1}));
  /* ----- 舊式工廈：橫向條窗、水漬 ----- */
  const IND=[['#b8b1a3','#8c8577'],['#a9b2b8','#7f8890'],['#c4b59a','#94866c']].map(([w1,w2])=>mat(facade(512,512,4,4,
    (g,W,H)=>{ g.fillStyle=w1; g.fillRect(0,0,W,H); for(let i=0;i<120;i++){ g.fillStyle='rgba(40,35,30,'+(pr()*0.08)+')'; g.fillRect(pr()*W,pr()*H*0.3,3+pr()*5,40+pr()*160); } },
    (g,x,y,w,h)=>{ g.fillStyle=w2; g.fillRect(x,y+h*0.25,w,h*0.5); g.fillStyle='#3c4650'; g.fillRect(x+3,y+h*0.28,w-6,h*0.44); g.fillStyle='rgba(170,200,215,.25)'; g.fillRect(x+3,y+h*0.28,w-6,h*0.12);
      g.fillStyle='#5c6670'; for(let k=1;k<4;k++) g.fillRect(x+k*w/4-1,y+h*0.28,3,h*0.44); },
    0.3,COOL,{winRect:(x,y,w,h)=>[x+3,y+h*0.28,w-6,h*0.44]}),{r:0.9,emk:0.85,us:16,vs:16}));
  /* ----- 酒店：石材直條＋窄窗 ----- */
  const HOTEL=[['#d8ccb6','#b7a688','#2b3440'],['#c9cfd6','#9ea8b3','#2a3a4c'],['#d6c3b4','#ae9481','#33302e']].map(([w1,w2,gl])=>mat(facade(512,1024,4,8,
    (g,W,H,bw)=>{ g.fillStyle=w1; g.fillRect(0,0,W,H); g.fillStyle=w2; for(let b=0;b<4;b++) g.fillRect(b*bw,0,14,H); },
    (g,x,y,w,h)=>{ g.fillStyle=gl; g.fillRect(x+w*0.25,y+h*0.12,w*0.6,h*0.74); g.fillStyle='rgba(180,205,230,.3)'; g.fillRect(x+w*0.25,y+h*0.12,w*0.6,h*0.2); g.fillStyle=w2; g.fillRect(x+w*0.22,y+h*0.86,w*0.66,5); },
    0.55,WARM,{winRect:(x,y,w,h)=>[x+w*0.25,y+h*0.12,w*0.6,h*0.74]}),{r:0.7,emk:1}));
  /* ----- 多層停車場 ----- */
  const PARK=mat(facade(512,512,2,4,(g,W,H)=>{ g.fillStyle='#b9b6ae'; g.fillRect(0,0,W,H); },
    (g,x,y,w,h)=>{ g.fillStyle='#1d2126'; g.fillRect(x,y+h*0.3,w,h*0.55); g.fillStyle='#8b8f94'; g.fillRect(x+w-10,y+h*0.3,10,h*0.55); g.fillStyle='#e0ddd4'; g.fillRect(x,y+h*0.85,w,h*0.15);
      if(pr()<0.7){ g.fillStyle=pp(['#c0392b','#ecf0f1','#2c3e50','#2980b9','#7f8c8d']); g.fillRect(x+w*(0.1+pr()*0.5),y+h*0.62,w*0.3,h*0.18); } },
    1,['#ffcf7a'],{winRect:(x,y,w,h)=>[x,y+h*0.32,w,h*0.12]}),{r:0.92,emk:0.7,us:12,vs:12});
  /* ----- 商場平台：大塊玻璃＋石材，頂部燈帶 ----- */
  const MALL=[['#e6e1d8','#2c3946'],['#d5dbe0','#1f2c3a'],['#3a3f46','#1a222c']].map(([st,gl])=>mat(facade(512,256,4,1,
    (g,W,H)=>{ g.fillStyle=st; g.fillRect(0,0,W,H); g.fillStyle='rgba(0,0,0,.12)'; g.fillRect(0,0,W,14); },
    (g,x,y,w,h)=>{ g.fillStyle=gl; g.fillRect(x+8,y+40,w-16,h-56); g.fillStyle='rgba(200,225,245,.25)'; g.fillRect(x+8,y+40,w-16,30); g.fillStyle='#8b949e'; g.fillRect(x+w/2-2,y+40,4,h-56); },
    1,WARM,{winRect:(x,y,w,h)=>[x+8,y+40,w-16,h-56],emAfter:(g,W)=>{ g.fillStyle='#7fd8ff'; g.fillRect(0,18,W,8); }}),{r:0.55,m:0.2,env:0.5,emk:0.55,us:24,vs:6}));
  /* ----- 公屋（高清）：粉色外牆＋窗格 ----- */
  const EST=[['#f3d7d0','#d99c8e'],['#d8e8d0','#97b98a'],['#d6e2f0','#8aa6c8'],['#f2e6c4','#d1b46e'],['#e4d9ef','#a993c8'],['#f5efe6','#e0a96d']].map(([w1,w2])=>mat(facade(512,1024,4,8,
    (g,W,H,bw,fh)=>{ g.fillStyle=w1; g.fillRect(0,0,W,H); g.fillStyle=w2; g.fillRect(0,0,22,H); g.fillRect(W-22,0,22,H); for(let f=0;f<8;f++) g.fillRect(0,f*fh+fh-5,W,5); },
    (g,x,y,w,h)=>{ g.fillStyle='#41586d'; g.fillRect(x+w*0.2,y+h*0.2,w*0.6,h*0.5); g.fillStyle='rgba(200,225,240,.4)'; g.fillRect(x+w*0.2,y+h*0.2,w*0.6,h*0.14); g.fillStyle='#fafafa'; g.fillRect(x+w*0.49,y+h*0.2,4,h*0.5);
      if(pr()<0.35){ g.fillStyle=pp(['#ffffff','#4cc9f0','#f72585','#ffd166','#90be6d']); g.fillRect(x+w*0.25,y+h*0.72,w*0.5,6); } },
    0.5,WARM,{winRect:(x,y,w,h)=>[x+w*0.2,y+h*0.2,w*0.6,h*0.5]}),{r:0.85,emk:0.95,us:16,vs:24}));
  /* ----- 天台、石材、金屬 ----- */
  const roofT=ctex(256,256,(g,W,H)=>{ g.fillStyle='#7d7f80'; g.fillRect(0,0,W,H); for(let i=0;i<900;i++){ const v=100+pr()*60|0; g.fillStyle='rgba('+v+','+v+','+(v+4)+',.35)'; g.fillRect(pr()*W,pr()*H,2+pr()*10,2+pr()*10); }
    g.strokeStyle='rgba(40,40,40,.35)'; g.lineWidth=2; for(let k=0;k<=4;k++){ g.beginPath(); g.moveTo(k*64,0); g.lineTo(k*64,H); g.moveTo(0,k*64); g.lineTo(W,k*64); g.stroke(); } });
  const ROOF=new THREE.MeshStandardMaterial({map:roofT,roughness:0.95});
  const solid=c=>{ const m=new THREE.MeshStandardMaterial({color:c,roughness:0.6,metalness:0.3}); return m; };
  const STEEL=solid(0x4a5058), TANK=solid(0xd9dfe4), PLANT=solid(0x9aa2aa), CROWN=solid(0x2a313a);
  const CROWNL=new THREE.MeshStandardMaterial({color:0xdfe8f0,emissive:0x000000,roughness:0.4}); CROWNL.userData.pc={glow:0x7fd0ff}; ALL.push(CROWNL);
  /* ----- LED 廣告牌（自創品牌） ----- */
  const ADS=[['星河電訊','5G 極速上網','#1b1f6b','#5ee7ff'],['富豪地產','海景新盤 現正發售','#3a0a0a','#ffd166'],['飛躍運動','JUST RUN','#0b0b0b','#ff3b3b'],['綠洲飲品','清涼一夏','#0d3b2e','#7dff9a'],
    ['金滿樓','點心 · 海鮮','#5a0d0d','#ffcf5a'],['Q-MART','24 小時營業','#0a2a5a','#ffffff'],['夜光錶行','LUMINA','#1a0d2e','#e08cff'],['港燈旅遊','東京 $1888 起','#0a3d62','#ffeaa7']]
    .map(([a,b,bg,fg])=>{ const t=ctex(512,256,(g,W,H)=>{ const gr=g.createLinearGradient(0,0,W,H); gr.addColorStop(0,bg); gr.addColorStop(1,'#000'); g.fillStyle=gr; g.fillRect(0,0,W,H);
        g.fillStyle=fg; g.globalAlpha=0.18; for(let i=0;i<6;i++){ g.beginPath(); g.arc(pr()*W,pr()*H,30+pr()*90,0,7); g.fill(); } g.globalAlpha=1;
        g.font='900 92px "PingFang HK","Noto Sans TC","Microsoft JhengHei",sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillStyle=fg; g.fillText(a,W/2,H*0.42,W-40);
        g.font='700 40px "PingFang HK","Noto Sans TC","Microsoft JhengHei",sans-serif'; g.fillStyle='#fff'; g.fillText(b,W/2,H*0.78,W-40);
        g.strokeStyle=fg; g.lineWidth=8; g.strokeRect(6,6,W-12,H-12); },false);
      const m=new THREE.MeshStandardMaterial({map:t,emissiveMap:t,emissive:0xffffff,emissiveIntensity:0.55,roughness:0.5}); m.userData.pc={ad:true}; ALL.push(m); return m; });
  const HOTELN=['海景酒店','星光酒店','HARBOUR HOTEL','皇庭酒店','GRAND VIEW'];
  const HSIGN=HOTELN.map(n=>{ const t=ctex(512,128,(g,W,H)=>{ g.clearRect(0,0,W,H); g.font='900 80px "PingFang HK","Noto Sans TC",sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillStyle='#ffe9b8'; g.fillText(n,W/2,H/2,W-20); },false);
    const m=new THREE.MeshStandardMaterial({map:t,transparent:true,emissiveMap:t,emissive:0xffffff,emissiveIntensity:0.3,depthWrite:false,side:THREE.DoubleSide}); m.userData.pc={ad:true}; ALL.push(m); return m; });
  /* ----- 佔地坐標：x 沿街（0…bw），z 入深（0…bd，0 係街邊） ----- */
  function frame(c){ const ex=c[1][0]-c[0][0], ez=c[1][1]-c[0][1], bw=Math.hypot(ex,ez), dx=c[3][0]-c[0][0], dz=c[3][1]-c[0][1], bd=Math.hypot(dx,dz);
    const ux=ex/bw, uz=ez/bw, vx=dx/bd, vz=dz/bd; const P=(x,z)=>[c[0][0]+ux*x+vx*z, c[0][1]+uz*x+vz*z];
    return {bw,bd,P,ux,uz,vx,vz,Q:(x0,z0,x1,z1)=>[P(x0,z0),P(x1,z0),P(x1,z1),P(x0,z1)],yaw:Math.atan2(-vx,-vz)}; }
  const AV=[], PADS=[], SIGNS=[];   // 航空警示燈、直升機坪、酒店招牌
  const avi=(F,x,z,y)=>{ const p=F.P(x,z); AV.push([p[0],y,p[1]]); };
  function roofKit(F,x0,z0,x1,z1,y,big){   // 天台：水缸、樓梯屋、機房、天線
    const w=x1-x0, d=z1-z0; if(w<4||d<4) return y;
    const n=big?2+(pr()*3|0):1+(pr()*2|0);
    for(let k=0;k<n;k++){ const sw=Math.min(w*0.4,rng(2.2,5)), sd=Math.min(d*0.4,rng(2.2,5)), sx=x0+0.8+pr()*(w-sw-1.6), sz=z0+0.8+pr()*(d-sd-1.6), sh=rng(1.6,3.6);
      boxQ(F.Q(sx,sz,sx+sw,sz+sd),y,y+sh,pp([PLANT,TANK,ROOF]),ROOF,4,3); }
    if(pr()<0.6){ const ax=x0+w*rng(0.2,0.8), az=z0+d*rng(0.2,0.8), ah=rng(4,10); boxQ(F.Q(ax,az,ax+0.18,az+0.18),y,y+ah,STEEL,STEEL,1,1); if(y+ah>55) avi(F,ax,az,y+ah+0.2); }
    return y; }
  function parapet(F,x0,z0,x1,z1,y,m){ const t=0.35, h=1.1; [[x0,z0,x1,z0+t],[x0,z1-t,x1,z1],[x0,z0,x0+t,z1],[x1-t,z0,x1,z1]].forEach(([a,b,c2,d])=>boxQ(F.Q(a,b,c2,d),y,y+h,m||ROOF,ROOF,...(m?UV(m):[4,3]))); }
  function billboard(F,y,w,h){   // 天台廣告牌：向街，腳架
    const x0=(F.bw-w)/2; const z=1.2; const m=pp(ADS);
    for(let k=0;k<=2;k++){ const px=x0+k*w/2-0.1; boxQ(F.Q(px,z+0.3,px+0.2,z+0.5),y,y+2,STEEL,STEEL,1,1); }
    boxQ(F.Q(x0,z,x0+w,z+0.3),y+2,y+2+h,m,STEEL,w,h); return y+2+h; }
  const UV=m=>m.userData.pc&&m.userData.pc.us?[m.userData.pc.us,m.userData.pc.vs]:[8,3];
  const tower=(F,x0,z0,x1,z1,y0,y1,m,u)=>{ const [a,b]=UV(m); boxQ(F.Q(x0,z0,x1,z1),y0,y1,m,ROOF,a,b,u||0); };
  const uo=()=>(pr()*4|0)*0.25;
  /* ----- 樓款 ----- */
  const K={
    office(F,big){ const pod=big?rng(9,13):rng(5,7); const pm=pp(MALL); tower(F,0,0,F.bw,F.bd,0.3,pod,pm); boxQ(F.Q(0,0,F.bw,F.bd),pod,pod+0.4,STEEL,ROOF,8,1);
      const g=pp(GLASS); let ix=big?3:1.2, iz=big?3:1.2, y=pod, H=big?rng(70,135):rng(45,95); let x0=ix, z0=iz, x1=F.bw-ix, z1=F.bd-iz; const tiers=pr()<0.6?2:pr()<0.5?3:1; const u=uo();
      for(let t=0;t<tiers;t++){ const top=t===tiers-1?pod+H:y+(pod+H-y)*rng(0.55,0.75); tower(F,x0,z0,x1,z1,y,top,g,u); y=top; if(t<tiers-1){ const s=Math.min((x1-x0)*0.12,(z1-z0)*0.12,rng(1.5,3)); boxQ(F.Q(x0,z0,x1,z1),y,y+0.5,CROWN,ROOF,8,1); x0+=s; z0+=s; x1-=s; z1-=s; } }
      // 樓頂：玻璃冠／發光框／直升機坪
      const w=x1-x0, d=z1-z0, r=pr();
      if(r<0.4&&w>9&&d>9){ boxQ(F.Q(x0,z0,x1,z1),y,y+1.2,CROWN,ROOF,8,1); const pz=PADS.length; const c=F.P((x0+x1)/2,(z0+z1)/2); PADS.push([c[0],y+1.25,c[1],Math.min(w,d)*0.8,F.yaw]); y+=1.2; }
      else if(r<0.75){ const fh=rng(4,9); [[x0,z0,x1,z0+0.4],[x0,z1-0.4,x1,z1],[x0,z0,x0+0.4,z1],[x1-0.4,z0,x1,z1]].forEach(([a,b,c2,d2])=>boxQ(F.Q(a,b,c2,d2),y,y+fh,g,ROOF,...UV(g),u)); boxQ(F.Q(x0,z0,x1,z1),y+fh-0.5,y+fh,CROWNL,CROWNL,8,1); roofKit(F,x0,z0,x1,z1,y,true); y+=fh; }
      else { boxQ(F.Q(x0+w*0.3,z0+d*0.3,x1-w*0.3,z1-d*0.3),y,y+rng(3,6),CROWN,CROWNL,4,3); roofKit(F,x0,z0,x1,z1,y,true); }
      [[x0,z0],[x1,z0],[x1,z1],[x0,z1]].forEach(([a,b])=>avi(F,a,b,y+0.3)); return y; },
    resi(F){ boxQ(F.Q(0,0,F.bw,F.bd),0.3,4.8,pp(shopMats),ROOF,24,4.5,pr()*4|0); const m=pp(RESI); const H=rng(40,88); const y=4.8+H;
      tower(F,0.5,0,F.bw-0.5,F.bd-1,4.8,y,m,uo()); parapet(F,0.5,0,F.bw-0.5,F.bd-1,y,m);
      boxQ(F.Q(F.bw*0.3,F.bd*0.35,F.bw*0.7,F.bd*0.75),y,y+3.2,m,ROOF,...UV(m)); boxQ(F.Q(F.bw*0.35,F.bd*0.4,F.bw*0.65,F.bd*0.7),y+3.2,y+5,TANK,TANK,4,3);
      if(y>60) avi(F,F.bw/2,F.bd*0.55,y+5.2); return y+5; },
    industrial(F){ const m=pp(IND); const H=rng(18,34); tower(F,0,0,F.bw,F.bd,0.3,H,m,uo()); parapet(F,0,0,F.bw,F.bd,H,m);
      let y=H; if(pr()<0.55&&F.bw>9) y=billboard(F,H,Math.min(F.bw-1.5,14),rng(3.5,5)); else roofKit(F,0.5,0.5,F.bw-0.5,F.bd-0.5,H,true); return Math.max(H,y); },
    hotel(F){ const pod=rng(6,9); tower(F,0,0,F.bw,F.bd,0.3,pod,pp(MALL)); boxQ(F.Q(-0.2,-0.2,F.bw+0.2,F.bd+0.2),pod,pod+0.5,CROWN,ROOF,8,1);
      const m=pp(HOTEL); const H=rng(30,72), y=pod+H; tower(F,0.8,0.8,F.bw-0.8,F.bd-0.8,pod,y,m,uo());
      boxQ(F.Q(0.4,0.4,F.bw-0.4,F.bd-0.4),y,y+1.4,CROWN,ROOF,8,1); boxQ(F.Q(1.2,1.2,F.bw-1.2,F.bd-1.2),y+1.4,y+1.9,CROWNL,CROWNL,8,1);
      const p=F.P(F.bw/2,0.3); SIGNS.push([p[0],y+3.2,p[1],Math.min(F.bw*0.9,16),F.yaw,pp(HSIGN)]); if(y>55) avi(F,F.bw/2,F.bd/2,y+2); return y+2; },
    carpark(F){ const H=rng(12,19); tower(F,0,0,F.bw,F.bd,0.3,H,PARK,0); parapet(F,0,0,F.bw,F.bd,H,PARK); boxQ(F.Q(F.bw-5,F.bd-5,F.bw-1,F.bd-1),H,H+3,PARK,ROOF,...UV(PARK));
      const p=F.P(1.2,-0.1); SIGNS.push([p[0],H-1.4,p[1],2.2,F.yaw,null]); return H+3; },
    mall(F){ const m=pp(MALL), H=rng(14,24); let y=0.3; while(y<H-1){ const t=Math.min(H,y+6); tower(F,0,0,F.bw,F.bd,y,t,m); y=t; }
      parapet(F,0,0,F.bw,F.bd,H,CROWN);
      const w=Math.min(F.bw*0.7,14), h=Math.min(H-8,rng(6,9)), x0=(F.bw-w)/2; boxQ(F.Q(x0,-0.45,x0+w,-0.1),H-h-1.5,H-1.5,pp(ADS),STEEL,w,h);   // 外牆 LED 大電視
      let top=H; if(pr()<0.5) top=billboard(F,H,Math.min(F.bw-2,13),rng(3.5,5)); else roofKit(F,0.5,0.5,F.bw-0.5,F.bd-0.5,H,true); return Math.max(H,top); },
    cross(F){   // 十字型公屋
      boxQ(F.Q(0,0,F.bw,F.bd),0.3,4.8,pp(shopMats),podMat,24,4.5); const m=pp(EST), n=F.bw>38?2:1; let top=4.8;
      for(let k=0;k<n;k++){ const cx=n===1?F.bw/2:(k?F.bw*0.74:F.bw*0.26), cz=F.bd/2, a=n===1?Math.min(13,F.bw/2-2):Math.min(9,F.bw/4-1), b=Math.min(12,F.bd/2-1.2), t=n===1?4.6:3.6, H=4.8+rng(55,95);
        boxQ(F.Q(cx-a,cz-t,cx+a,cz+t),4.8,H,m,ROOF,...UV(m),uo()); boxQ(F.Q(cx-t,cz-b,cx+t,cz+b),4.8,H,m,ROOF,...UV(m),uo());
        boxQ(F.Q(cx-t*0.8,cz-t*0.8,cx+t*0.8,cz+t*0.8),H,H+4,m,ROOF,...UV(m)); boxQ(F.Q(cx-a,cz-t,cx+a,cz+t),H,H+1,m,ROOF,...UV(m)); boxQ(F.Q(cx-t,cz-b,cx+t,cz+b),H,H+1,m,ROOF,...UV(m));
        if(H>60) avi(F,cx,cz,H+4.2); top=Math.max(top,H+4); }
      return top; },
    twins(F){   // 私人屋苑：平台＋兩座高樓
      const pod=rng(8,11); tower(F,0,0,F.bw,F.bd,0.3,pod,pp(MALL)); boxQ(F.Q(0,0,F.bw,F.bd),pod,pod+0.3,podMat,podMat,8,1);
      const m=pp(pr()<0.5?RESI:GLASS), tw=Math.min(15,(F.bw-6)/2), td=Math.min(16,F.bd-6); let top=pod; const u=uo();
      [0,1].forEach(k=>{ const x0=k?F.bw-3-tw:3, z0=(F.bd-td)/2, H=pod+rng(70,125); tower(F,x0,z0,x0+tw,z0+td,pod,H,m,u);
        boxQ(F.Q(x0+1,z0+1,x0+tw-1,z0+td-1),H,H+5,CROWN,ROOF,8,3); boxQ(F.Q(x0+0.6,z0+0.6,x0+tw-0.6,z0+td-0.6),H+5,H+5.6,CROWNL,CROWNL,8,1);
        [[x0,z0],[x0+tw,z0],[x0+tw,z0+td],[x0,z0+td]].forEach(([a,b])=>avi(F,a,b,H+5.8)); top=Math.max(top,H+5.6); });
      return top; } };
  const ZK={   // 每種原本嘅佔地 → 可以換成嘅樓款（'orig' = 保留原本港式樓）
    tong:{old:['orig','orig','resi','industrial','industrial','hotel'],centre:['orig','resi','resi','hotel','office'],res:['orig','resi','resi','hotel','carpark']},
    shops:{old:['industrial','carpark','mall','hotel','office'],centre:['office','office','mall','hotel','carpark'],res:['mall','carpark','office','hotel','industrial']},
    estate:{old:['orig','cross','office','twins'],centre:['office','twins','twins','cross','office'],res:['cross','cross','twins','orig','office']} };
  let SKIP=false;
  return {
    get skip(){ return SKIP; }, last:'orig', ALL,
    // 沿街：type＝原本樓款；run(origFn)＝原本建樓（照計 rnd）
    street(type,zone,c,orig){ const k=pp((ZK[type]||ZK.tong)[zone]||ZK[type].res); this.last=k; if(k==='orig'){ orig(); return; }
      SKIP=true; try{ orig(); } finally{ SKIP=false; }
      const F=frame(c); const h=k==='office'?K.office(F,type==='estate'):K[k](F); MAP.blds[MAP.blds.length-1].h=h; },
    // 內街高樓（16×14）
    inner(c,h){ const F=frame(c), r=pr(); this.last='inner';
      if(r<0.45){ const m=pp(EST), H=h*rng(1.2,1.8); tower(F,0,0,F.bw,F.bd,0,H,m,uo()); parapet(F,0,0,F.bw,F.bd,H,m); boxQ(F.Q(F.bw*0.3,F.bd*0.3,F.bw*0.7,F.bd*0.7),H,H+4,m,ROOF,...UV(m)); return H+4; }
      if(r<0.8){ const m=pp(RESI), H=h*rng(1.3,2); tower(F,0,0,F.bw,F.bd,0,H,m,uo()); parapet(F,0,0,F.bw,F.bd,H,m); roofKit(F,1,1,F.bw-1,F.bd-1,H,false); if(H>60) avi(F,F.bw/2,F.bd/2,H+1.4); return H; }
      const H=h*rng(1.4,2.4); tower(F,0,0,F.bw,F.bd,0,H,pp(GLASS),uo()); boxQ(F.Q(1,1,F.bw-1,F.bd-1),H,H+3,CROWN,CROWNL,4,3); [[0,0],[F.bw,0],[F.bw,F.bd],[0,F.bd]].forEach(([a,b])=>avi(F,a,b,H+0.3)); return H+3; },
    finish(){   // 航空燈、直升機坪、酒店招牌
      const avm=new THREE.MeshBasicMaterial({color:0xff2a2a,toneMapped:false,fog:false}); const im=new THREE.InstancedMesh(new THREE.SphereGeometry(0.42,8,6),avm,Math.max(1,AV.length)); const o=new THREE.Object3D();
      AV.forEach(([x,y,z],i)=>{ o.position.set(x,y,z); o.updateMatrix(); im.setMatrixAt(i,o.matrix); }); im.count=AV.length; scene.add(im); this.av=im; this.avm=avm;
      const padT=ctex(256,256,(g,W,H)=>{ g.fillStyle='#3d4247'; g.fillRect(0,0,W,H); g.strokeStyle='#f4f4f4'; g.lineWidth=10; g.beginPath(); g.arc(128,128,100,0,7); g.stroke(); g.strokeStyle='#ffd23f'; g.lineWidth=6; g.strokeRect(10,10,W-20,H-20);
        g.font='900 140px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillStyle='#f4f4f4'; g.fillText('H',128,136); },false);
      const pm=new THREE.MeshStandardMaterial({map:padT,roughness:0.9}); const pim=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),pm,Math.max(1,PADS.length));
      PADS.forEach(([x,y,z,s,a],i)=>{ o.position.set(x,y,z); o.rotation.set(-Math.PI/2,0,a); o.scale.set(s,s,1); o.updateMatrix(); pim.setMatrixAt(i,o.matrix); }); pim.count=PADS.length; pim.receiveShadow=true; scene.add(pim);
      o.scale.set(1,1,1);
      const pk=ctex(128,128,(g)=>{ g.fillStyle='#1e5bd8'; g.fillRect(0,0,128,128); g.font='900 110px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillStyle='#fff'; g.fillText('P',64,70); },false);
      const pkm=new THREE.MeshStandardMaterial({map:pk,emissiveMap:pk,emissive:0xffffff,emissiveIntensity:0.4}); pkm.userData.pc={ad:true}; ALL.push(pkm);
      SIGNS.forEach(([x,y,z,w,a,m])=>{ const g=new THREE.PlaneGeometry(w,m?w/4:w); const s=new THREE.Mesh(g,m||pkm); s.position.set(x,y,z); s.rotation.y=a; s.renderOrder=1; scene.add(s); });
      console.log('電腦畫質樓宇：航空燈',AV.length,'直升機坪',PADS.length,'招牌',SIGNS.length); },
    // 日／夜：窗燈、玻璃反光、廣告牌亮度
    setEnv(env,night,wet){ if(this.road){ const R_=this.road; R_.roughness=wet?0.22:night?0.5:0.88; R_.envMap=env&&(night||wet)?env:null; R_.envMapIntensity=wet?1.1:0.55; R_.needsUpdate=true; }
      ALL.forEach(m=>{ const u=m.userData.pc; if(u.shop){ m.emissiveIntensity=night?0.6:0.1; return; } if(u.ad){ m.emissiveIntensity=u.lo?(night?0.3:0.06):night?1.25:0.5; return; }
        if(u.glow){ m.emissive.setHex(night?u.glow:0); m.emissiveIntensity=night?1.6:0; return; }
        m.emissive.setHex(night?0xffffff:0x000000); m.emissiveIntensity=night?0.78*u.emk:0; if(u.env){ m.envMap=env; m.envMapIntensity=u.env*(night?0.55:1); } m.needsUpdate=true; }); },
    roadMat(){ const t=ctex(512,512,(g,W,H)=>{ g.fillStyle='#5b6270'; g.fillRect(0,0,W,H); for(let i=0;i<9000;i++){ const v=70+pr()*60|0; g.fillStyle='rgba('+v+','+v+','+(v+6)+','+(0.25+pr()*0.35)+')'; g.fillRect(pr()*W,pr()*H,1+pr()*2.5,1+pr()*2.5); }
        for(let i=0;i<14;i++){ const rg=g.createRadialGradient(0,0,2,0,0,60); const x=pr()*W, y=pr()*H; g.save(); g.translate(x,y); g.scale(1,0.5+pr()); rg.addColorStop(0,'rgba(30,32,38,.22)'); rg.addColorStop(1,'rgba(30,32,38,0)'); g.fillStyle=rg; g.fillRect(-60,-60,120,120); g.restore(); } });
      t.repeat.set(0.25,0.25); const m=new THREE.MeshStandardMaterial({map:t,roughness:0.88,color:0xdfe3ea}); this.road=m; return m; },
    walkMat(){ const t=ctex(512,512,(g,W,H)=>{ const C=['#d9d2c5','#cfc6b6','#c9b9a8','#ddd5c9','#bfb3a2']; for(let y=0;y<H;y+=32) for(let x=0;x<W;x+=64){ const o=(y/32%2)*32; g.fillStyle=pp(C); g.fillRect(x+o-64,y,62,30); g.fillRect(x+o,y,62,30); }
        for(let i=0;i<2500;i++){ g.fillStyle='rgba(80,70,60,'+(pr()*0.12)+')'; g.fillRect(pr()*W,pr()*H,2,2); } });
      t.repeat.set(0.75,0.75); return new THREE.MeshStandardMaterial({map:t,roughness:0.9}); },
    tick(t){ if(this.avm){ const on=(t%1.6)<0.7; this.avm.color.setHex(on?0xff2a2a:0x3a0808); } } };
})();
if(PCB) window.__PCB=PCB;

/* ---------- 合併幾何（任意四邊形底） ---------- */
const buckets=new Map();
function bucket(mat){ if(!buckets.has(mat)) buckets.set(mat,{p:[],n:[],u:[]}); return buckets.get(mat); }
// c：四個角 [[x,z]×4]（任何次序順時針／逆時針都得）
function boxQ(c,y0,y1,sideMat,topMat,us=8,vs=3,uOff=0){ if(PCB&&PCB.skip) return;
  const cx=(c[0][0]+c[1][0]+c[2][0]+c[3][0])/4, cz=(c[0][1]+c[1][1]+c[2][1]+c[3][1])/4;
  if(!topMat||topMat===roofMat) topMat=roofMats[Math.abs((cx*7+cz*13)|0)%roofMats.length];
  const sb=bucket(sideMat), tb=bucket(topMat);
  for(let i=0;i<4;i++){ let P=c[i], Q=c[(i+1)%4]; const ex=Q[0]-P[0], ez=Q[1]-P[1], L=Math.hypot(ex,ez)||1;
    let nx=ez/L, nz=-ex/L; const mx=(P[0]+Q[0])/2-cx, mz=(P[1]+Q[1])/2-cz; if(nx*mx+nz*mz<0){ nx=-nx; nz=-nz; }
    // 由外面望：左→右 = (nz,-nx)
    if(ex*nz+ez*(-nx)<0){ const t=P; P=Q; Q=t; }
    const u1=uOff+L/us, v1=(y1-y0)/vs;
    sb.p.push(P[0],y0,P[1], Q[0],y0,Q[1], Q[0],y1,Q[1],  P[0],y0,P[1], Q[0],y1,Q[1], P[0],y1,P[1]);
    for(let k=0;k<6;k++) sb.n.push(nx,0,nz);
    sb.u.push(uOff,0, u1,0, u1,v1,  uOff,0, u1,v1, uOff,v1); }
  const tri=(A,B,Cc)=>{ const y=(B[1]-A[1])*(Cc[0]-A[0])-(B[0]-A[0])*(Cc[1]-A[1]); const T=y>=0?[A,B,Cc]:[A,Cc,B];
    T.forEach(p=>{ tb.p.push(p[0],y1,p[1]); tb.n.push(0,1,0); const s=topMat===walkMat?3:8; tb.u.push(p[0]/s,p[1]/s); }); };
  tri(c[0],c[1],c[2]); tri(c[0],c[2],c[3]);
}
const rectQ=(x0,z0,x1,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
// 分區合併：每 200 米一格各自一個 mesh，鏡頭睇唔到嘅格（同影子）會自動唔畫
const CHUNK=200;
function flushBuckets(){ buckets.forEach((b,mat)=>{ const P=b.p,N=b.n,U=b.u;
  if(typeof ELEV==='function') for(let i=0;i<P.length;i+=3) P[i+1]+=ELEV(P[i],P[i+2]);   // 元朗公路高架：抬高路面同橋身
  const groups=new Map(); const tri=P.length%9===0&&U.length*3===P.length*2;
  if(!tri) groups.set('all',{p:P,n:N,u:U});
  else for(let t=0;t<P.length;t+=9){ const k=Math.floor((P[t]+P[t+3]+P[t+6])/3/CHUNK)+','+Math.floor((P[t+2]+P[t+5]+P[t+8])/3/CHUNK);
    let g=groups.get(k); if(!g){ g={p:[],n:[],u:[]}; groups.set(k,g); }
    for(let j=0;j<9;j++){ g.p.push(P[t+j]); g.n.push(N[t+j]); } const uo=t/9*6; for(let j=0;j<6;j++) g.u.push(U[uo+j]); }
  groups.forEach(gp=>{ const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(gp.p,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(gp.n,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(gp.u,2));
    g.computeBoundingSphere(); const m=new THREE.Mesh(g,mat); m.castShadow=true; m.receiveShadow=true; m.matrixAutoUpdate=false; m.updateMatrix(); scene.add(m); }); }); buckets.clear(); }
// 山丘：半球體，合併入同一批幾何
const HILLG=new THREE.SphereGeometry(1,12,6,0,Math.PI*2,0,Math.PI/2).toNonIndexed();
function hillQ(x,z,r,h,r2,rot,mat){ const bk=bucket(mat), P=HILLG.attributes.position.array, N=HILLG.attributes.normal.array, U=HILLG.attributes.uv.array, c=Math.cos(rot), s=Math.sin(rot);
  for(let i=0;i<P.length;i+=3){ const lx=P[i]*r, lz=P[i+2]*r2; bk.p.push(x+lx*c-lz*s,P[i+1]*h,z+lx*s+lz*c); const nx=N[i]/r, ny=N[i+1]/h, nz=N[i+2]/r2, L=Math.hypot(nx,ny,nz)||1; bk.n.push(nx/L,ny/L,nz/L); }
  for(let i=0;i<U.length;i++) bk.u.push(U[i]*4); }
// 平面（帶世界坐標 UV）
function flat(arr,mat,y,uvs=3){ // 統一三角形方向（由上面望係逆時針），法線向上；按 200 米分區，元朗公路高架段跟住抬高
  for(let i=0;i<arr.length;i+=9){ const ax=arr[i],az=arr[i+2],bx=arr[i+3],bz=arr[i+5],cx=arr[i+6],cz=arr[i+8]; if((bz-az)*(cx-ax)-(bx-ax)*(cz-az)<0){ arr[i+3]=cx; arr[i+5]=cz; arr[i+6]=bx; arr[i+8]=bz; } }
  if(typeof ELEV==='function') for(let i=0;i<arr.length;i+=3) arr[i+1]+=ELEV(arr[i],arr[i+2]);
  const groups=new Map(); for(let t=0;t<arr.length;t+=9){ const k=Math.floor((arr[t]+arr[t+3]+arr[t+6])/3/CHUNK)+','+Math.floor((arr[t+2]+arr[t+5]+arr[t+8])/3/CHUNK);
    let g=groups.get(k); if(!g){ g=[]; groups.set(k,g); } for(let j=0;j<9;j++) g.push(arr[t+j]); }
  let last=null; groups.forEach(a=>{ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(a,3));
    const uv=[]; for(let i=0;i<a.length;i+=3) uv.push(a[i]/uvs,a[i+2]/uvs); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    const n=[]; for(let i=0;i<a.length;i+=3) n.push(0,1,0); g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3)); g.computeBoundingSphere();
    const m=new THREE.Mesh(g,mat); m.position.y=y||0; m.receiveShadow=true; m.matrixAutoUpdate=false; m.updateMatrix(); scene.add(m); last=m; }); return last; }
const ribbon=(arr,A,B,half)=>{ const dx=B[0]-A[0], dz=B[1]-A[1], L=Math.hypot(dx,dz)||1; const nx=dz/L*half, nz=-dx/L*half;
  arr.push(A[0]+nx,0,A[1]+nz, B[0]+nx,0,B[1]+nz, B[0]-nx,0,B[1]-nz,  A[0]+nx,0,A[1]+nz, B[0]-nx,0,B[1]-nz, A[0]-nx,0,A[1]-nz); };
const disc=(arr,C0,r,seg=16)=>{ for(let i=0;i<seg;i++){ const a=i/seg*Math.PI*2, b=(i+1)/seg*Math.PI*2; arr.push(C0[0],0,C0[1], C0[0]+Math.cos(a)*r,0,C0[1]+Math.sin(a)*r, C0[0]+Math.cos(b)*r,0,C0[1]+Math.sin(b)*r); } };
const quadA=(arr,c)=>arr.push(c[0][0],0,c[0][1], c[1][0],0,c[1][1], c[2][0],0,c[2][1], c[0][0],0,c[0][1], c[2][0],0,c[2][1], c[3][0],0,c[3][1]);

/* ---------- 版圖（簡化真實屯門） ---------- */
const REGION=(()=>{ try{ const v=JSON.parse(localStorage.getItem('a188.region')||'"tm"'); return v==='sr'?(window.SR_DATA?'sr':'st'):v==='st'?'st':'tm'; }catch(e){ return 'tm'; } })();   // 地區：屯門（連元朗、天水圍）／沙田（獨立地圖）
const LAY=REGION==='sr'?window.SR_DATA.lay:REGION==='st'?{"S":0.4,"nodes":[[132.0,56.0],[148.4,34.0],[163.0,10.0],[172.0,-8.0],[181.1,-31.6],[192.0,-60.0],[202.9,-83.6],[216.0,-112.0],[226.9,-135.6],[240.0,-164.0],[250.9,-185.8],[264.0,-212.0],[279.4,-230.5],[294.8,-248.9],[304.0,-260.0],[319.8,-279.7],[337.0,-301.3],[352.0,-320.5],[367.0,-340.1],[381.9,-359.9],[401.8,-385.5],[417.5,-405.0],[440.0,-432.0],[456.7,-450.9],[473.3,-469.8],[490.0,-488.7],[500.0,-500.0],[107.2,65.0],[80.7,72.2],[48.0,76.0],[0.0,0.0],[15.8,22.5],[31.4,46.6],[144.4,-8.0],[119.5,-7.9],[92.9,-7.2],[65.9,-5.8],[38.5,-3.5],[13.8,-1.2],[165.8,-66.6],[142.0,-72.5],[117.0,-79.1],[92.0,-86.1],[67.0,-93.5],[32.0,-104.0],[191.1,-117.2],[163.9,-123.2],[136.5,-130.9],[110.2,-140.2],[87.9,-149.4],[72.0,-156.0],[215.5,-174.5],[187.9,-186.1],[161.2,-196.8],[132.0,-208.0],[250.9,-242.2],[239.0,-269.5],[228.7,-292.8],[218.2,-316.3],[207.5,-340.0],[196.8,-363.2],[180.0,-400.0],[-12.2,-21.6],[-26.0,-46.0],[-38.9,-68.6],[-51.5,-90.5],[-63.9,-111.6],[-79.0,-137.0],[-92.5,-159.5],[-100.0,-172.0],[-360.0,400.0],[-344.8,380.7],[-329.7,361.4],[-314.5,342.1],[-299.3,322.8],[-284.1,303.4],[-272.0,288.0],[-254.0,266.9],[-238.5,248.6],[-220.2,227.2],[-200.8,204.8],[-181.0,182.2],[-164.9,164.2],[-148.6,146.2],[-132.1,128.2],[-115.6,110.6],[-95.8,90.0],[-76.9,70.9],[-58.9,53.4],[-40.0,36.0],[-18.8,16.9],[-294.1,277.0],[-316.1,265.9],[-338.2,254.9],[-360.3,243.9],[-382.3,232.8],[-400.0,224.0],[-333.8,408.4],[-306.3,417.2],[-283.1,424.6],[-255.4,432.6],[-227.9,439.9],[-200.8,446.5],[-175.4,452.1],[-150.1,457.8],[-140.0,460.0],[-118.1,447.5],[-94.1,433.8],[-70.0,420.0],[-48.1,407.4],[-26.2,394.4],[-4.4,381.2],[17.5,367.7],[39.4,353.8],[61.2,339.8],[83.9,324.9],[107.2,309.6],[140.0,288.0],[162.6,278.5],[185.3,269.1],[207.9,259.6],[230.5,250.1],[253.2,240.6],[275.8,231.2],[298.4,221.7],[312.0,216.0],[331.4,193.5],[348.8,173.2],[366.2,153.0],[385.5,130.4],[402.9,109.0],[417.6,90.0],[432.1,70.5],[446.2,50.6],[460.0,30.2],[473.5,9.4],[486.7,-11.9],[500.2,-34.2],[515.6,-59.7],[530.2,-83.9],[540.0,-100.0],[561.2,-111.2],[582.5,-122.5],[608.0,-136.0],[627.0,-151.2],[646.1,-166.5],[665.1,-181.7],[688.0,-200.0],[-116.6,465.6],[-90.0,472.0],[-65.9,477.9],[-38.1,484.9],[-13.2,491.5],[15.1,499.3],[32.0,504.0],[162.8,305.5],[182.1,320.1],[206.9,337.9],[228.8,352.5],[240.0,360.0],[615.5,-108.8],[622.0,-85.2],[628.5,-60.8],[634.3,-34.9],[639.5,-7.8],[643.9,20.9],[647.0,44.8],[649.6,68.6],[652.2,93.3],[656.0,128.0],[151.7,80.9],[170.0,103.6],[188.7,123.1],[209.2,141.4],[230.4,158.4],[254.5,175.8],[278.2,192.4],[300.8,208.1],[267.3,-160.1],[296.1,-156.0],[324.7,-151.8],[348.6,-147.7],[373.1,-143.0],[396.6,-137.9],[420.6,-132.2],[445.1,-126.0],[470.0,-119.2],[497.5,-111.7],[525.0,-104.1],[331.5,-261.9],[356.2,-263.6],[381.0,-265.2],[408.6,-266.8],[437.0,-266.4],[466.1,-264.0],[491.2,-260.4],[515.6,-255.6],[540.5,-249.5],[565.9,-242.0],[591.8,-233.3],[615.2,-225.2],[639.2,-216.9],[662.0,-209.0]],"edges":[{"a":0,"b":1,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":1,"b":2,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":2,"b":3,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":3,"b":4,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":4,"b":5,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":5,"b":6,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":6,"b":7,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":7,"b":8,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":8,"b":9,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":9,"b":10,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":10,"b":11,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":11,"b":12,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":12,"b":13,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":13,"b":14,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":14,"b":15,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":15,"b":16,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":16,"b":17,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":17,"b":18,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":18,"b":19,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":19,"b":20,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":20,"b":21,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":21,"b":22,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":22,"b":23,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":23,"b":24,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":24,"b":25,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":25,"b":26,"t":"avenue","name":"\u6e90\u79be\u8def"},{"a":0,"b":27,"t":"street","name":"\u62c5\u6746\u8386\u8857"},{"a":27,"b":28,"t":"street","name":"\u62c5\u6746\u8386\u8857"},{"a":28,"b":29,"t":"street","name":"\u62c5\u6746\u8386\u8857"},{"a":30,"b":31,"t":"street","name":"\u6c99\u7530\u6b63\u8857"},{"a":31,"b":32,"t":"street","name":"\u6c99\u7530\u6b63\u8857"},{"a":32,"b":29,"t":"street","name":"\u6c99\u7530\u6b63\u8857"},{"a":3,"b":33,"t":"street","name":"\u6a6b\u58c6\u8857"},{"a":33,"b":34,"t":"street","name":"\u6a6b\u58c6\u8857"},{"a":34,"b":35,"t":"street","name":"\u6a6b\u58c6\u8857"},{"a":35,"b":36,"t":"street","name":"\u6a6b\u58c6\u8857"},{"a":36,"b":37,"t":"street","name":"\u6a6b\u58c6\u8857"},{"a":37,"b":38,"t":"street","name":"\u6a6b\u58c6\u8857"},{"a":38,"b":30,"t":"street","name":"\u6a6b\u58c6\u8857"},{"a":5,"b":39,"t":"street","name":"\u6c99\u7530\u9109\u4e8b\u6703\u8def"},{"a":39,"b":40,"t":"street","name":"\u6c99\u7530\u9109\u4e8b\u6703\u8def"},{"a":40,"b":41,"t":"street","name":"\u6c99\u7530\u9109\u4e8b\u6703\u8def"},{"a":41,"b":42,"t":"street","name":"\u6c99\u7530\u9109\u4e8b\u6703\u8def"},{"a":42,"b":43,"t":"street","name":"\u6c99\u7530\u9109\u4e8b\u6703\u8def"},{"a":43,"b":44,"t":"street","name":"\u6c99\u7530\u9109\u4e8b\u6703\u8def"},{"a":7,"b":45,"t":"street","name":"\u79be\u8f0b\u8857"},{"a":45,"b":46,"t":"street","name":"\u79be\u8f0b\u8857"},{"a":46,"b":47,"t":"street","name":"\u79be\u8f0b\u8857"},{"a":47,"b":48,"t":"street","name":"\u79be\u8f0b\u8857"},{"a":48,"b":49,"t":"street","name":"\u79be\u8f0b\u8857"},{"a":49,"b":50,"t":"street","name":"\u79be\u8f0b\u8857"},{"a":9,"b":51,"t":"street","name":"\u5fb7\u539a\u8857"},{"a":51,"b":52,"t":"street","name":"\u5fb7\u539a\u8857"},{"a":52,"b":53,"t":"street","name":"\u5fb7\u539a\u8857"},{"a":53,"b":54,"t":"street","name":"\u5fb7\u539a\u8857"},{"a":11,"b":55,"t":"street","name":"\u706b\u70ad\u8def"},{"a":55,"b":56,"t":"street","name":"\u706b\u70ad\u8def"},{"a":56,"b":57,"t":"street","name":"\u706b\u70ad\u8def"},{"a":57,"b":58,"t":"street","name":"\u706b\u70ad\u8def"},{"a":58,"b":59,"t":"street","name":"\u706b\u70ad\u8def"},{"a":59,"b":60,"t":"street","name":"\u706b\u70ad\u8def"},{"a":60,"b":61,"t":"street","name":"\u706b\u70ad\u8def"},{"a":30,"b":62,"t":"street","name":"\u6392\u982d\u8857"},{"a":62,"b":63,"t":"street","name":"\u6392\u982d\u8857"},{"a":63,"b":64,"t":"street","name":"\u6392\u982d\u8857"},{"a":64,"b":65,"t":"street","name":"\u6392\u982d\u8857"},{"a":65,"b":66,"t":"street","name":"\u6392\u982d\u8857"},{"a":66,"b":67,"t":"street","name":"\u6392\u982d\u8857"},{"a":67,"b":68,"t":"street","name":"\u6392\u982d\u8857"},{"a":68,"b":69,"t":"street","name":"\u6392\u982d\u8857"},{"a":70,"b":71,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":71,"b":72,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":72,"b":73,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":73,"b":74,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":74,"b":75,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":75,"b":76,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":76,"b":77,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":77,"b":78,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":78,"b":79,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":79,"b":80,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":80,"b":81,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":81,"b":82,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":82,"b":83,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":83,"b":84,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":84,"b":85,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":85,"b":86,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":86,"b":87,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":87,"b":88,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":88,"b":89,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":89,"b":90,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":90,"b":30,"t":"main","name":"\u5927\u57d4\u516c\u8def"},{"a":76,"b":91,"t":"street","name":"\u5bcc\u5065\u8857"},{"a":91,"b":92,"t":"street","name":"\u5bcc\u5065\u8857"},{"a":92,"b":93,"t":"street","name":"\u5bcc\u5065\u8857"},{"a":93,"b":94,"t":"street","name":"\u5bcc\u5065\u8857"},{"a":94,"b":95,"t":"street","name":"\u5bcc\u5065\u8857"},{"a":95,"b":96,"t":"street","name":"\u5bcc\u5065\u8857"},{"a":70,"b":97,"t":"main","name":"\u5927\u570d\u6a4b"},{"a":97,"b":98,"t":"main","name":"\u5927\u570d\u6a4b"},{"a":98,"b":99,"t":"main","name":"\u5927\u570d\u6a4b"},{"a":99,"b":100,"t":"main","name":"\u5927\u570d\u6a4b"},{"a":100,"b":101,"t":"main","name":"\u5927\u570d\u6a4b"},{"a":101,"b":102,"t":"main","name":"\u5927\u570d\u6a4b"},{"a":102,"b":103,"t":"main","name":"\u5927\u570d\u6a4b"},{"a":103,"b":104,"t":"main","name":"\u5927\u570d\u6a4b"},{"a":104,"b":105,"t":"main","name":"\u5927\u570d\u6a4b"},{"a":105,"b":106,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":106,"b":107,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":107,"b":108,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":108,"b":109,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":109,"b":110,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":110,"b":111,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":111,"b":112,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":112,"b":113,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":113,"b":114,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":114,"b":115,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":115,"b":116,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":116,"b":117,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":117,"b":118,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":118,"b":119,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":119,"b":120,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":120,"b":121,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":121,"b":122,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":122,"b":123,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":123,"b":124,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":124,"b":125,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":125,"b":126,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":126,"b":127,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":127,"b":128,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":128,"b":129,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":129,"b":130,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":130,"b":131,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":131,"b":132,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":132,"b":133,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":133,"b":134,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":134,"b":135,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":135,"b":136,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":136,"b":137,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":137,"b":138,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":138,"b":139,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":139,"b":140,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":140,"b":141,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":141,"b":142,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":142,"b":143,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":143,"b":144,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":144,"b":145,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":145,"b":146,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":146,"b":147,"t":"main","name":"\u5927\u6d8c\u6a4b\u8def"},{"a":105,"b":148,"t":"street","name":"\u8eca\u516c\u5edf\u8def"},{"a":148,"b":149,"t":"street","name":"\u8eca\u516c\u5edf\u8def"},{"a":149,"b":150,"t":"street","name":"\u8eca\u516c\u5edf\u8def"},{"a":150,"b":151,"t":"street","name":"\u8eca\u516c\u5edf\u8def"},{"a":151,"b":152,"t":"street","name":"\u8eca\u516c\u5edf\u8def"},{"a":152,"b":153,"t":"street","name":"\u8eca\u516c\u5edf\u8def"},{"a":153,"b":154,"t":"street","name":"\u8eca\u516c\u5edf\u8def"},{"a":117,"b":155,"t":"street","name":"\u6c99\u89d2\u8857"},{"a":155,"b":156,"t":"street","name":"\u6c99\u89d2\u8857"},{"a":156,"b":157,"t":"street","name":"\u6c99\u89d2\u8857"},{"a":157,"b":158,"t":"street","name":"\u6c99\u89d2\u8857"},{"a":158,"b":159,"t":"street","name":"\u6c99\u89d2\u8857"},{"a":143,"b":160,"t":"street","name":"\u9280\u57ce\u8857"},{"a":160,"b":161,"t":"street","name":"\u9280\u57ce\u8857"},{"a":161,"b":162,"t":"street","name":"\u9280\u57ce\u8857"},{"a":162,"b":163,"t":"street","name":"\u9280\u57ce\u8857"},{"a":163,"b":164,"t":"street","name":"\u9280\u57ce\u8857"},{"a":164,"b":165,"t":"street","name":"\u9280\u57ce\u8857"},{"a":165,"b":166,"t":"street","name":"\u9280\u57ce\u8857"},{"a":166,"b":167,"t":"street","name":"\u9280\u57ce\u8857"},{"a":167,"b":168,"t":"street","name":"\u9280\u57ce\u8857"},{"a":168,"b":169,"t":"street","name":"\u9280\u57ce\u8857"},{"a":0,"b":170,"t":"main","name":"\u701d\u6e90\u6a4b"},{"a":170,"b":171,"t":"main","name":"\u701d\u6e90\u6a4b"},{"a":171,"b":172,"t":"main","name":"\u701d\u6e90\u6a4b"},{"a":172,"b":173,"t":"main","name":"\u701d\u6e90\u6a4b"},{"a":173,"b":174,"t":"main","name":"\u701d\u6e90\u6a4b"},{"a":174,"b":175,"t":"main","name":"\u701d\u6e90\u6a4b"},{"a":175,"b":176,"t":"main","name":"\u701d\u6e90\u6a4b"},{"a":176,"b":177,"t":"main","name":"\u701d\u6e90\u6a4b"},{"a":177,"b":125,"t":"main","name":"\u701d\u6e90\u6a4b"},{"a":9,"b":178,"t":"main","name":"\u6c99\u71d5\u6a4b"},{"a":178,"b":179,"t":"main","name":"\u6c99\u71d5\u6a4b"},{"a":179,"b":180,"t":"main","name":"\u6c99\u71d5\u6a4b"},{"a":180,"b":181,"t":"main","name":"\u6c99\u71d5\u6a4b"},{"a":181,"b":182,"t":"main","name":"\u6c99\u71d5\u6a4b"},{"a":182,"b":183,"t":"main","name":"\u6c99\u71d5\u6a4b"},{"a":183,"b":184,"t":"main","name":"\u6c99\u71d5\u6a4b"},{"a":184,"b":185,"t":"main","name":"\u6c99\u71d5\u6a4b"},{"a":185,"b":186,"t":"main","name":"\u6c99\u71d5\u6a4b"},{"a":186,"b":187,"t":"main","name":"\u6c99\u71d5\u6a4b"},{"a":187,"b":188,"t":"main","name":"\u6c99\u71d5\u6a4b"},{"a":188,"b":140,"t":"main","name":"\u6c99\u71d5\u6a4b"},{"a":14,"b":189,"t":"main","name":"\u6c99\u7530\u8def"},{"a":189,"b":190,"t":"main","name":"\u6c99\u7530\u8def"},{"a":190,"b":191,"t":"main","name":"\u6c99\u7530\u8def"},{"a":191,"b":192,"t":"main","name":"\u6c99\u7530\u8def"},{"a":192,"b":193,"t":"main","name":"\u6c99\u7530\u8def"},{"a":193,"b":194,"t":"main","name":"\u6c99\u7530\u8def"},{"a":194,"b":195,"t":"main","name":"\u6c99\u7530\u8def"},{"a":195,"b":196,"t":"main","name":"\u6c99\u7530\u8def"},{"a":196,"b":197,"t":"main","name":"\u6c99\u7530\u8def"},{"a":197,"b":198,"t":"main","name":"\u6c99\u7530\u8def"},{"a":198,"b":199,"t":"main","name":"\u6c99\u7530\u8def"},{"a":199,"b":200,"t":"main","name":"\u6c99\u7530\u8def"},{"a":200,"b":201,"t":"main","name":"\u6c99\u7530\u8def"},{"a":201,"b":202,"t":"main","name":"\u6c99\u7530\u8def"},{"a":202,"b":147,"t":"main","name":"\u6c99\u7530\u8def"}],"river":[[-560.0,600.0],[-557.2,598.1],[-551.6,594.4],[-543.1,588.8],[-531.9,581.2],[-517.8,571.9],[-500.9,560.6],[-481.2,547.5],[-458.8,532.5],[-435.9,517.8],[-412.8,503.4],[-389.4,489.4],[-365.6,475.6],[-341.6,462.2],[-317.2,449.1],[-292.5,436.2],[-267.5,423.8],[-242.2,411.2],[-216.6,398.8],[-190.6,386.2],[-164.4,373.8],[-137.8,361.2],[-110.9,348.8],[-83.8,336.2],[-56.2,323.8],[-29.4,311.1],[-3.1,298.2],[22.5,285.1],[47.5,271.9],[71.9,258.4],[95.6,244.8],[118.8,231.0],[141.2,217.0],[162.8,202.9],[183.4,188.6],[203.1,174.2],[221.9,159.8],[239.7,145.1],[256.6,130.4],[272.5,115.5],[287.5,100.5],[301.8,85.2],[315.2,69.6],[328.0,53.6],[340.0,37.4],[351.2,20.8],[361.8,3.9],[371.5,-13.2],[380.5,-30.8],[389.2,-47.9],[397.8,-64.6],[406.0,-81.0],[414.0,-97.0],[421.8,-112.6],[429.2,-127.9],[436.5,-142.8],[443.5,-157.2],[450.6,-171.7],[457.7,-186.1],[464.9,-200.4],[472.1,-214.6],[479.4,-228.8],[486.8,-242.9],[494.2,-257.0],[501.8,-271.0],[509.8,-284.8],[518.4,-298.4],[527.6,-311.9],[537.4,-325.1],[547.7,-338.2],[558.6,-351.1],[570.0,-363.8],[582.0,-376.2],[594.9,-388.8],[608.8,-401.2],[623.6,-413.8],[639.4,-426.2],[656.1,-438.8],[673.7,-451.2],[692.2,-463.8],[711.8,-476.2],[731.6,-488.4],[751.9,-500.3],[772.5,-511.9],[793.5,-523.1],[814.9,-534.1],[836.6,-544.7],[858.8,-555.0],[881.2,-565.0],[900.9,-573.8],[917.8,-581.2],[931.9,-587.5],[943.1,-592.5],[951.6,-596.2],[957.2,-598.8],[960.0,-600.0]],"lake":[[236.0,28.0],[237.2,27.6],[239.8,26.9],[243.5,25.8],[248.5,24.2],[252.9,23.9],[256.6,24.6],[259.8,26.5],[262.2,29.5],[263.8,32.9],[264.2,36.6],[263.8,40.8],[262.2,45.2],[259.9,48.9],[256.6,51.6],[252.5,53.5],[247.5,54.5],[243.0,54.5],[239.0,53.5],[235.5,51.5],[232.5,48.5],[230.8,45.2],[230.2,41.8],[231.0,38.0],[233.0,34.0],[234.5,31.0],[235.5,29.0],[236.0,28.0]],"bounds":[-480.0,-620.0,820.0,580.0],"J":{"DG":0,"HB":3,"XS":5,"WC":7,"TH":9,"FT":11,"STR":14,"SI":22,"RC":26,"ZJ":29,"STN":30,"XW":44,"WCW":50,"THW":54,"FTN":61,"PT":69,"TW":70,"TS":76,"TSD":96,"S1":105,"SK":117,"LY":125,"SY":140,"C1":143,"C1E":147,"CK":154,"SKE":159,"PWH":169}}:{"S":0.4,"nodes":[[-152.0,-312.0],[-137.0,-292.5],[-121.9,-273.0],[-106.9,-253.4],[-88.8,-230.0],[-87.5,-200.5],[-86.3,-173.8],[-85.2,-146.2],[-84.1,-119.2],[-83.2,-92.8],[-82.0,-56.0],[-79.0,-31.0],[-76.0,-6.0],[-73.0,19.0],[-71.2,34.0],[-82.9,59.9],[-94.4,81.9],[-107.8,102.5],[-120.0,120.0],[-127.9,146.2],[-136.2,175.9],[-142.7,204.5],[-148.8,236.0],[-154.2,260.3],[-159.7,284.6],[-164.0,304.0],[-128.4,-318.6],[-102.6,-325.2],[-76.8,-328.2],[-52.0,-326.8],[-26.0,-321.9],[-16.0,-320.0],[-7.0,-342.5],[4.9,-368.4],[18.4,-393.7],[24.0,-404.0],[-256.0,-224.0],[-231.1,-229.2],[-203.5,-234.6],[-178.1,-236.8],[-151.3,-236.5],[-123.7,-233.8],[-60.8,-228.7],[-36.8,-229.1],[-12.0,-231.2],[15.0,-244.5],[39.0,-253.1],[63.0,-256.6],[87.0,-257.2],[111.0,-256.2],[132.0,-254.8],[-13.1,-255.9],[-14.2,-280.5],[-15.3,-305.2],[-256.0,-44.0],[-227.1,-45.3],[-201.0,-46.5],[-173.7,-48.1],[-146.6,-50.1],[-119.6,-52.5],[-95.4,-54.8],[-56.0,-58.1],[-31.8,-44.2],[-13.4,-20.4],[2.9,1.2],[17.6,20.8],[-69.6,-83.0],[-54.6,-103.2],[-33.0,-117.5],[-12.0,-128.0],[-12.0,-152.6],[-12.0,-177.1],[-12.0,-201.7],[46.0,11.4],[70.8,1.2],[95.0,-11.8],[116.0,-24.0],[160.0,-360.0],[154.2,-333.8],[148.0,-305.9],[140.8,-277.8],[144.2,-230.8],[156.4,-202.2],[162.2,-178.5],[164.6,-152.6],[160.5,-127.0],[153.1,-103.8],[143.1,-80.2],[130.6,-54.4],[118.2,3.0],[115.9,31.4],[109.5,57.2],[101.6,82.2],[96.0,100.0],[97.8,129.8],[99.8,154.1],[105.1,181.2],[115.6,211.6],[129.8,239.8],[142.3,262.6],[160.6,286.8],[178.6,303.6],[188.0,312.0],[193.2,336.5],[198.1,364.5],[200.0,392.5],[200.0,424.0],[204.0,448.0],[208.0,472.0],[-256.0,208.0],[-232.7,214.1],[-209.4,220.2],[-186.1,226.3],[-162.8,232.3],[-118.7,245.6],[-93.5,252.8],[-62.7,257.0],[-35.4,256.1],[-8.2,252.9],[12.0,248.8],[35.3,241.8],[68.0,232.0],[91.8,221.8],[16.0,45.3],[14.3,69.7],[12.0,104.0],[8.7,128.9],[5.4,156.1],[4.5,183.6],[6.4,210.1],[10.4,238.1],[7.6,273.9],[4.0,294.0],[7.8,319.0],[10.0,334.0],[10.7,358.3],[11.3,382.6],[12.0,406.9],[12.8,436.0],[12.8,461.7],[12.8,472.0],[75.0,256.0],[82.0,280.0],[88.8,305.0],[92.8,320.0],[96.0,348.0],[99.3,378.5],[102.1,405.0],[104.8,432.0],[28.4,289.6],[52.8,285.2],[34.4,329.9],[58.7,325.8],[37.0,434.9],[61.2,433.9],[85.4,432.8],[129.0,430.2],[155.1,428.2],[182.5,425.8],[71.2,98.9],[44.7,99.5],[12.9,-327.9],[39.0,-334.9],[66.5,-341.8],[94.0,-347.8],[121.5,-353.0],[146.2,-357.5],[176.0,-378.7],[192.0,-397.3],[208.0,-416.0],[224.0,-434.7],[240.0,-453.3],[256.0,-472.0],[274.1,-488.2],[294.1,-506.1],[314.0,-524.0],[335.5,-543.2],[354.1,-559.8],[372.2,-576.0],[394.3,-595.6],[415.8,-614.5],[435.5,-631.9],[456.4,-650.2],[472.0,-664.0],[253.2,-500.1],[250.8,-524.5],[248.5,-549.8],[247.2,-576.2],[247.0,-603.9],[247.9,-632.8],[249.8,-662.9],[251.7,-687.3],[253.8,-716.7],[255.5,-744.9],[256.9,-771.8],[257.9,-797.5],[258.9,-826.2],[260.0,-860.0],[160.0,-860.0],[185.0,-860.0],[210.0,-860.0],[235.0,-860.0],[285.0,-860.0],[310.0,-860.0],[335.0,-860.0],[360.0,-860.0],[260.0,-884.2],[260.0,-908.4],[260.0,-932.6],[260.0,-952.0],[260.0,-976.2],[260.0,-1000.4],[260.0,-1024.6],[260.0,-1044.0],[160.0,-952.0],[185.0,-952.0],[210.0,-952.0],[235.0,-952.0],[285.0,-952.0],[310.0,-952.0],[335.0,-952.0],[360.0,-952.0],[160.0,-1044.0],[185.0,-1044.0],[210.0,-1044.0],[235.0,-1044.0],[285.0,-1044.0],[310.0,-1044.0],[335.0,-1044.0],[360.0,-1044.0],[160.0,-884.2],[160.0,-908.4],[160.0,-932.6],[160.0,-976.2],[160.0,-1000.4],[160.0,-1024.6],[360.0,-884.2],[360.0,-908.4],[360.0,-932.6],[360.0,-976.2],[360.0,-1000.4],[360.0,-1024.6],[135.7,-952.0],[111.4,-952.0],[92.0,-952.0],[388.0,-847.8],[410.9,-836.9],[436.1,-820.6],[456.1,-803.9],[478.0,-790.8],[496.0,-784.0],[496.8,-667.8],[521.5,-671.6],[546.3,-675.4],[576.0,-680.0],[600.8,-680.0],[625.5,-680.0],[650.3,-680.0],[680.0,-680.0],[704.8,-680.0],[729.5,-680.0],[754.3,-680.0],[784.0,-680.0],[806.5,-689.0],[831.5,-702.8],[850.9,-717.5],[864.0,-728.0],[476.8,-688.0],[481.6,-712.0],[486.4,-736.0],[491.2,-760.0],[521.0,-784.0],[546.0,-784.0],[576.0,-784.0],[600.8,-784.0],[625.5,-784.0],[650.3,-784.0],[680.0,-784.0],[576.0,-759.2],[576.0,-734.5],[576.0,-709.7],[680.0,-759.2],[680.0,-734.5],[680.0,-709.7],[576.0,-656.0],[576.0,-632.0],[576.0,-608.0],[576.0,-584.0],[680.0,-656.0],[680.0,-632.0],[680.0,-608.0],[680.0,-584.0],[600.8,-584.0],[625.5,-584.0],[650.3,-584.0],[704.8,-584.0],[729.5,-584.0],[754.3,-584.0],[784.0,-584.0],[784.0,-656.0],[784.0,-632.0],[784.0,-608.0]],"edges":[{"a":0,"b":1,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":1,"b":2,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":2,"b":3,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":3,"b":4,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":4,"b":5,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":5,"b":6,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":6,"b":7,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":7,"b":8,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":8,"b":9,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":9,"b":10,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":10,"b":11,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":11,"b":12,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":12,"b":13,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":13,"b":14,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":14,"b":15,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":15,"b":16,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":16,"b":17,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":17,"b":18,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":18,"b":19,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":19,"b":20,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":20,"b":21,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":21,"b":22,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":22,"b":23,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":23,"b":24,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":24,"b":25,"t":"main","name":"\u9707\u5bf0\u8def"},{"a":0,"b":26,"t":"street","name":"\u9752\u677e\u89c0\u8def"},{"a":26,"b":27,"t":"street","name":"\u9752\u677e\u89c0\u8def"},{"a":27,"b":28,"t":"street","name":"\u9752\u677e\u89c0\u8def"},{"a":28,"b":29,"t":"street","name":"\u9752\u677e\u89c0\u8def"},{"a":29,"b":30,"t":"street","name":"\u9752\u677e\u89c0\u8def"},{"a":30,"b":31,"t":"street","name":"\u9752\u677e\u89c0\u8def"},{"a":31,"b":32,"t":"street","name":"\u9752\u677e\u89c0\u8def\u5317"},{"a":32,"b":33,"t":"street","name":"\u9752\u677e\u89c0\u8def\u5317"},{"a":33,"b":34,"t":"street","name":"\u9752\u677e\u89c0\u8def\u5317"},{"a":34,"b":35,"t":"street","name":"\u9752\u677e\u89c0\u8def\u5317"},{"a":36,"b":37,"t":"main","name":"\u9752\u7530\u8def"},{"a":37,"b":38,"t":"main","name":"\u9752\u7530\u8def"},{"a":38,"b":39,"t":"main","name":"\u9752\u7530\u8def"},{"a":39,"b":40,"t":"main","name":"\u9752\u7530\u8def"},{"a":40,"b":41,"t":"main","name":"\u9752\u7530\u8def"},{"a":41,"b":4,"t":"main","name":"\u9752\u7530\u8def"},{"a":4,"b":42,"t":"main","name":"\u9752\u7530\u8def"},{"a":42,"b":43,"t":"main","name":"\u9752\u7530\u8def"},{"a":43,"b":44,"t":"main","name":"\u9752\u7530\u8def"},{"a":44,"b":45,"t":"main","name":"\u9752\u7530\u8def"},{"a":45,"b":46,"t":"main","name":"\u9752\u7530\u8def"},{"a":46,"b":47,"t":"main","name":"\u9752\u7530\u8def"},{"a":47,"b":48,"t":"main","name":"\u9752\u7530\u8def"},{"a":48,"b":49,"t":"main","name":"\u9752\u7530\u8def"},{"a":49,"b":50,"t":"main","name":"\u9752\u7530\u8def"},{"a":44,"b":51,"t":"street","name":"\u91ab\u9662\u8def"},{"a":51,"b":52,"t":"street","name":"\u91ab\u9662\u8def"},{"a":52,"b":53,"t":"street","name":"\u91ab\u9662\u8def"},{"a":53,"b":31,"t":"street","name":"\u91ab\u9662\u8def"},{"a":54,"b":55,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":55,"b":56,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":56,"b":57,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":57,"b":58,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":58,"b":59,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":59,"b":60,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":60,"b":10,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":10,"b":61,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":61,"b":62,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":62,"b":63,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":63,"b":64,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":64,"b":65,"t":"main","name":"\u77f3\u6392\u982d\u8def"},{"a":10,"b":66,"t":"street","name":"\u8208\u5b89\u91cc"},{"a":66,"b":67,"t":"street","name":"\u8208\u5b89\u91cc"},{"a":67,"b":68,"t":"street","name":"\u8208\u5b89\u91cc"},{"a":68,"b":69,"t":"street","name":"\u8208\u5b89\u91cc"},{"a":69,"b":70,"t":"street","name":"\u8208\u5b89\u91cc"},{"a":70,"b":71,"t":"street","name":"\u8208\u5b89\u91cc"},{"a":71,"b":72,"t":"street","name":"\u8208\u5b89\u91cc"},{"a":72,"b":44,"t":"street","name":"\u8208\u5b89\u91cc"},{"a":65,"b":73,"t":"street","name":"\u65b0\u589f\u8def"},{"a":73,"b":74,"t":"street","name":"\u65b0\u589f\u8def"},{"a":74,"b":75,"t":"street","name":"\u65b0\u589f\u8def"},{"a":75,"b":76,"t":"street","name":"\u65b0\u589f\u8def"},{"a":77,"b":78,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":78,"b":79,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":79,"b":80,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":80,"b":50,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":50,"b":81,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":81,"b":82,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":82,"b":83,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":83,"b":84,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":84,"b":85,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":85,"b":86,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":86,"b":87,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":87,"b":88,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":88,"b":76,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":76,"b":89,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":89,"b":90,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":90,"b":91,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":91,"b":92,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":92,"b":93,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":93,"b":94,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":94,"b":95,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":95,"b":96,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":96,"b":97,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":97,"b":98,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":98,"b":99,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":99,"b":100,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":100,"b":101,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":101,"b":102,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":102,"b":103,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":103,"b":104,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":104,"b":105,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":105,"b":106,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":106,"b":107,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":107,"b":108,"t":"main","name":"\u9752\u5c71\u516c\u8def"},{"a":109,"b":110,"t":"main","name":"\u676f\u6e21\u8def"},{"a":110,"b":111,"t":"main","name":"\u676f\u6e21\u8def"},{"a":111,"b":112,"t":"main","name":"\u676f\u6e21\u8def"},{"a":112,"b":113,"t":"main","name":"\u676f\u6e21\u8def"},{"a":113,"b":22,"t":"main","name":"\u676f\u6e21\u8def"},{"a":22,"b":114,"t":"main","name":"\u676f\u6e21\u8def"},{"a":114,"b":115,"t":"main","name":"\u676f\u6e21\u8def"},{"a":115,"b":116,"t":"main","name":"\u676f\u6e21\u8def"},{"a":116,"b":117,"t":"main","name":"\u676f\u6e21\u8def"},{"a":117,"b":118,"t":"main","name":"\u676f\u6e21\u8def"},{"a":118,"b":119,"t":"main","name":"\u676f\u6e21\u8def"},{"a":119,"b":120,"t":"main","name":"\u676f\u6e21\u8def"},{"a":120,"b":121,"t":"main","name":"\u676f\u6e21\u8def"},{"a":121,"b":122,"t":"main","name":"\u676f\u6e21\u8def"},{"a":122,"b":97,"t":"main","name":"\u676f\u6e21\u8def"},{"a":65,"b":123,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":123,"b":124,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":124,"b":125,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":125,"b":126,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":126,"b":127,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":127,"b":128,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":128,"b":129,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":129,"b":130,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":130,"b":119,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":119,"b":131,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":131,"b":132,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":132,"b":133,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":133,"b":134,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":134,"b":135,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":135,"b":136,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":136,"b":137,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":137,"b":138,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":138,"b":139,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":139,"b":140,"t":"avenue","name":"\u5c6f\u9580\u9109\u4e8b\u6703\u8def"},{"a":121,"b":141,"t":"street","name":"\u5c6f\u559c\u8def"},{"a":141,"b":142,"t":"street","name":"\u5c6f\u559c\u8def"},{"a":142,"b":143,"t":"street","name":"\u5c6f\u559c\u8def"},{"a":143,"b":144,"t":"street","name":"\u5c6f\u559c\u8def"},{"a":144,"b":145,"t":"street","name":"\u5c6f\u559c\u8def"},{"a":145,"b":146,"t":"street","name":"\u5c6f\u559c\u8def"},{"a":146,"b":147,"t":"street","name":"\u5c6f\u559c\u8def"},{"a":147,"b":148,"t":"street","name":"\u5c6f\u559c\u8def"},{"a":132,"b":149,"t":"street","name":"\u5c6f\u9806\u8857"},{"a":149,"b":150,"t":"street","name":"\u5c6f\u9806\u8857"},{"a":150,"b":142,"t":"street","name":"\u5c6f\u9806\u8857"},{"a":134,"b":151,"t":"street","name":"\u5c6f\u76db\u8857"},{"a":151,"b":152,"t":"street","name":"\u5c6f\u76db\u8857"},{"a":152,"b":144,"t":"street","name":"\u5c6f\u76db\u8857"},{"a":138,"b":153,"t":"main","name":"\u5c6f\u8208\u8def"},{"a":153,"b":154,"t":"main","name":"\u5c6f\u8208\u8def"},{"a":154,"b":155,"t":"main","name":"\u5c6f\u8208\u8def"},{"a":155,"b":148,"t":"main","name":"\u5c6f\u8208\u8def"},{"a":148,"b":156,"t":"main","name":"\u5c6f\u8208\u8def"},{"a":156,"b":157,"t":"main","name":"\u5c6f\u8208\u8def"},{"a":157,"b":158,"t":"main","name":"\u5c6f\u8208\u8def"},{"a":158,"b":106,"t":"main","name":"\u5c6f\u8208\u8def"},{"a":93,"b":159,"t":"street","name":"\u5c6f\u8cb4\u8def"},{"a":159,"b":160,"t":"street","name":"\u5c6f\u8cb4\u8def"},{"a":160,"b":125,"t":"street","name":"\u5c6f\u8cb4\u8def"},{"a":31,"b":161,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":161,"b":162,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":162,"b":163,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":163,"b":164,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":164,"b":165,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":165,"b":166,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":166,"b":77,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":77,"b":167,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":167,"b":168,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":168,"b":169,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":169,"b":170,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":170,"b":171,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":171,"b":172,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":172,"b":173,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":173,"b":174,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":174,"b":175,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":175,"b":176,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":176,"b":177,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":177,"b":178,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":178,"b":179,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":179,"b":180,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":180,"b":181,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":181,"b":182,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":182,"b":183,"t":"main","name":"\u5143\u6717\u516c\u8def"},{"a":172,"b":184,"t":"main","name":"\u5929\u6c34\u570d\u8def"},{"a":184,"b":185,"t":"main","name":"\u5929\u6c34\u570d\u8def"},{"a":185,"b":186,"t":"main","name":"\u5929\u6c34\u570d\u8def"},{"a":186,"b":187,"t":"main","name":"\u5929\u6c34\u570d\u8def"},{"a":187,"b":188,"t":"main","name":"\u5929\u6c34\u570d\u8def"},{"a":188,"b":189,"t":"main","name":"\u5929\u6c34\u570d\u8def"},{"a":189,"b":190,"t":"main","name":"\u5929\u6c34\u570d\u8def"},{"a":190,"b":191,"t":"main","name":"\u5929\u6c34\u570d\u8def"},{"a":191,"b":192,"t":"main","name":"\u5929\u6c34\u570d\u8def"},{"a":192,"b":193,"t":"main","name":"\u5929\u6c34\u570d\u8def"},{"a":193,"b":194,"t":"main","name":"\u5929\u6c34\u570d\u8def"},{"a":194,"b":195,"t":"main","name":"\u5929\u6c34\u570d\u8def"},{"a":195,"b":196,"t":"main","name":"\u5929\u6c34\u570d\u8def"},{"a":196,"b":197,"t":"main","name":"\u5929\u6c34\u570d\u8def"},{"a":198,"b":199,"t":"main","name":"\u5929\u745e\u8def"},{"a":199,"b":200,"t":"main","name":"\u5929\u745e\u8def"},{"a":200,"b":201,"t":"main","name":"\u5929\u745e\u8def"},{"a":201,"b":197,"t":"main","name":"\u5929\u745e\u8def"},{"a":197,"b":202,"t":"main","name":"\u5929\u745e\u8def"},{"a":202,"b":203,"t":"main","name":"\u5929\u745e\u8def"},{"a":203,"b":204,"t":"main","name":"\u5929\u745e\u8def"},{"a":204,"b":205,"t":"main","name":"\u5929\u745e\u8def"},{"a":197,"b":206,"t":"avenue","name":"\u5929\u79c0\u8def"},{"a":206,"b":207,"t":"avenue","name":"\u5929\u79c0\u8def"},{"a":207,"b":208,"t":"avenue","name":"\u5929\u79c0\u8def"},{"a":208,"b":209,"t":"avenue","name":"\u5929\u79c0\u8def"},{"a":209,"b":210,"t":"avenue","name":"\u5929\u79c0\u8def"},{"a":210,"b":211,"t":"avenue","name":"\u5929\u79c0\u8def"},{"a":211,"b":212,"t":"avenue","name":"\u5929\u79c0\u8def"},{"a":212,"b":213,"t":"avenue","name":"\u5929\u79c0\u8def"},{"a":214,"b":215,"t":"street","name":"\u5929\u6e56\u8def"},{"a":215,"b":216,"t":"street","name":"\u5929\u6e56\u8def"},{"a":216,"b":217,"t":"street","name":"\u5929\u6e56\u8def"},{"a":217,"b":209,"t":"street","name":"\u5929\u6e56\u8def"},{"a":209,"b":218,"t":"street","name":"\u5929\u6e56\u8def"},{"a":218,"b":219,"t":"street","name":"\u5929\u6e56\u8def"},{"a":219,"b":220,"t":"street","name":"\u5929\u6e56\u8def"},{"a":220,"b":221,"t":"street","name":"\u5929\u6e56\u8def"},{"a":222,"b":223,"t":"street","name":"\u5929\u6069\u8def"},{"a":223,"b":224,"t":"street","name":"\u5929\u6069\u8def"},{"a":224,"b":225,"t":"street","name":"\u5929\u6069\u8def"},{"a":225,"b":213,"t":"street","name":"\u5929\u6069\u8def"},{"a":213,"b":226,"t":"street","name":"\u5929\u6069\u8def"},{"a":226,"b":227,"t":"street","name":"\u5929\u6069\u8def"},{"a":227,"b":228,"t":"street","name":"\u5929\u6069\u8def"},{"a":228,"b":229,"t":"street","name":"\u5929\u6069\u8def"},{"a":198,"b":230,"t":"street","name":"\u5929\u57ce\u8def"},{"a":230,"b":231,"t":"street","name":"\u5929\u57ce\u8def"},{"a":231,"b":232,"t":"street","name":"\u5929\u57ce\u8def"},{"a":232,"b":214,"t":"street","name":"\u5929\u57ce\u8def"},{"a":214,"b":233,"t":"street","name":"\u5929\u57ce\u8def"},{"a":233,"b":234,"t":"street","name":"\u5929\u57ce\u8def"},{"a":234,"b":235,"t":"street","name":"\u5929\u57ce\u8def"},{"a":235,"b":222,"t":"street","name":"\u5929\u57ce\u8def"},{"a":205,"b":236,"t":"street","name":"\u5929\u83ef\u8def"},{"a":236,"b":237,"t":"street","name":"\u5929\u83ef\u8def"},{"a":237,"b":238,"t":"street","name":"\u5929\u83ef\u8def"},{"a":238,"b":221,"t":"street","name":"\u5929\u83ef\u8def"},{"a":221,"b":239,"t":"street","name":"\u5929\u83ef\u8def"},{"a":239,"b":240,"t":"street","name":"\u5929\u83ef\u8def"},{"a":240,"b":241,"t":"street","name":"\u5929\u83ef\u8def"},{"a":241,"b":229,"t":"street","name":"\u5929\u83ef\u8def"},{"a":214,"b":242,"t":"street","name":"\u5929\u58c7\u8857"},{"a":242,"b":243,"t":"street","name":"\u5929\u58c7\u8857"},{"a":243,"b":244,"t":"street","name":"\u5929\u58c7\u8857"},{"a":205,"b":245,"t":"main","name":"\u5c4f\u5ec8\u8def"},{"a":245,"b":246,"t":"main","name":"\u5c4f\u5ec8\u8def"},{"a":246,"b":247,"t":"main","name":"\u5c4f\u5ec8\u8def"},{"a":247,"b":248,"t":"main","name":"\u5c4f\u5ec8\u8def"},{"a":248,"b":249,"t":"main","name":"\u5c4f\u5ec8\u8def"},{"a":249,"b":250,"t":"main","name":"\u5c4f\u5ec8\u8def"},{"a":183,"b":251,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":251,"b":252,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":252,"b":253,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":253,"b":254,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":254,"b":255,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":255,"b":256,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":256,"b":257,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":257,"b":258,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":258,"b":259,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":259,"b":260,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":260,"b":261,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":261,"b":262,"t":"avenue","name":"\u5143\u6717\u5927\u99ac\u8def"},{"a":262,"b":263,"t":"main","name":"\u5773\u982d\u8def"},{"a":263,"b":264,"t":"main","name":"\u5773\u982d\u8def"},{"a":264,"b":265,"t":"main","name":"\u5773\u982d\u8def"},{"a":265,"b":266,"t":"main","name":"\u5773\u982d\u8def"},{"a":183,"b":267,"t":"main","name":"\u6717\u5929\u8def"},{"a":267,"b":268,"t":"main","name":"\u6717\u5929\u8def"},{"a":268,"b":269,"t":"main","name":"\u6717\u5929\u8def"},{"a":269,"b":270,"t":"main","name":"\u6717\u5929\u8def"},{"a":270,"b":250,"t":"main","name":"\u6717\u5929\u8def"},{"a":250,"b":271,"t":"street","name":"\u6717\u65e5\u8def"},{"a":271,"b":272,"t":"street","name":"\u6717\u65e5\u8def"},{"a":272,"b":273,"t":"street","name":"\u6717\u65e5\u8def"},{"a":273,"b":274,"t":"street","name":"\u6717\u65e5\u8def"},{"a":274,"b":275,"t":"street","name":"\u6717\u65e5\u8def"},{"a":275,"b":276,"t":"street","name":"\u6717\u65e5\u8def"},{"a":276,"b":277,"t":"street","name":"\u6717\u65e5\u8def"},{"a":273,"b":278,"t":"street","name":"\u5abd\u5edf\u8def"},{"a":278,"b":279,"t":"street","name":"\u5abd\u5edf\u8def"},{"a":279,"b":280,"t":"street","name":"\u5abd\u5edf\u8def"},{"a":280,"b":254,"t":"street","name":"\u5abd\u5edf\u8def"},{"a":277,"b":281,"t":"street","name":"\u9cf3\u7fd4\u8def"},{"a":281,"b":282,"t":"street","name":"\u9cf3\u7fd4\u8def"},{"a":282,"b":283,"t":"street","name":"\u9cf3\u7fd4\u8def"},{"a":283,"b":258,"t":"street","name":"\u9cf3\u7fd4\u8def"},{"a":254,"b":284,"t":"street","name":"\u64ca\u58e4\u8def"},{"a":284,"b":285,"t":"street","name":"\u64ca\u58e4\u8def"},{"a":285,"b":286,"t":"street","name":"\u64ca\u58e4\u8def"},{"a":286,"b":287,"t":"street","name":"\u64ca\u58e4\u8def"},{"a":258,"b":288,"t":"street","name":"\u99ac\u7530\u8def"},{"a":288,"b":289,"t":"street","name":"\u99ac\u7530\u8def"},{"a":289,"b":290,"t":"street","name":"\u99ac\u7530\u8def"},{"a":290,"b":291,"t":"street","name":"\u99ac\u7530\u8def"},{"a":287,"b":292,"t":"street","name":"\u9ad4\u80b2\u8def"},{"a":292,"b":293,"t":"street","name":"\u9ad4\u80b2\u8def"},{"a":293,"b":294,"t":"street","name":"\u9ad4\u80b2\u8def"},{"a":294,"b":291,"t":"street","name":"\u9ad4\u80b2\u8def"},{"a":291,"b":295,"t":"street","name":"\u9ad4\u80b2\u8def"},{"a":295,"b":296,"t":"street","name":"\u9ad4\u80b2\u8def"},{"a":296,"b":297,"t":"street","name":"\u9ad4\u80b2\u8def"},{"a":297,"b":298,"t":"street","name":"\u9ad4\u80b2\u8def"},{"a":262,"b":299,"t":"street","name":"\u6771\u5824\u8857"},{"a":299,"b":300,"t":"street","name":"\u6771\u5824\u8857"},{"a":300,"b":301,"t":"street","name":"\u6771\u5824\u8857"},{"a":301,"b":298,"t":"street","name":"\u6771\u5824\u8857"}],"river":[[177.6,-579.2],[176.6,-576.1],[174.7,-570.1],[171.8,-560.9],[167.9,-548.7],[163.1,-533.5],[157.3,-515.1],[150.5,-493.8],[142.7,-469.4],[135.4,-445.3],[128.5,-421.4],[122.0,-397.8],[115.9,-374.5],[110.2,-351.4],[104.9,-328.6],[100.0,-306.1],[95.6,-283.9],[91.0,-262.3],[86.3,-241.5],[81.4,-221.3],[76.4,-201.9],[71.3,-183.1],[66.0,-165.1],[60.6,-147.7],[55.0,-131.1],[49.3,-115.1],[43.5,-99.9],[37.5,-85.3],[31.4,-71.4],[25.1,-58.2],[18.7,-45.7],[12.2,-34.0],[5.5,-22.9],[-1.0,-11.8],[-7.1,-0.7],[-13.0,10.5],[-18.5,21.6],[-23.8,32.6],[-28.8,43.8],[-33.6,54.9],[-38.0,66.0],[-42.5,78.4],[-46.9,92.3],[-51.4,107.6],[-55.8,124.3],[-60.3,142.4],[-64.7,161.8],[-69.2,182.7],[-73.6,204.9],[-78.1,226.5],[-82.5,247.3],[-86.9,267.5],[-91.4,286.9],[-95.8,305.7],[-100.2,323.7],[-104.6,341.1],[-109.0,357.7],[-113.2,373.6],[-117.1,388.7],[-120.7,403.1],[-124.2,416.6],[-127.3,429.4],[-130.3,441.5],[-133.0,452.8],[-135.4,463.2],[-137.6,472.4],[-139.4,480.3],[-140.9,486.9],[-142.2,492.1],[-143.1,496.1],[-143.7,498.7],[-144.0,500.0]],"lake":[[-68.0,328.0],[-66.8,327.5],[-64.2,326.5],[-60.5,325.0],[-55.5,323.0],[-51.0,322.5],[-47.0,323.5],[-43.5,326.0],[-40.5,330.0],[-38.5,334.5],[-37.5,339.5],[-37.5,345.0],[-38.5,351.0],[-40.5,356.2],[-43.5,360.8],[-47.5,364.5],[-52.5,367.5],[-57.5,369.0],[-62.5,369.0],[-67.5,367.5],[-72.5,364.5],[-76.2,361.0],[-78.8,357.0],[-80.0,352.5],[-80.0,347.5],[-79.2,343.0],[-77.8,339.0],[-75.5,335.5],[-72.5,332.5],[-70.2,330.2],[-68.8,328.8],[-68.0,328.0]],"bounds":[-256.0,-1136.0,920.0,472.0],"J":{"W0":0,"W1":4,"W2":10,"W3":14,"W4":18,"W5":22,"W6":25,"H1":31,"HOSP":35,"Q0":36,"H0":44,"Q4":50,"S0":54,"N0":65,"K0":69,"E1":76,"E0":77,"E2":93,"E3":97,"E4":102,"E5":106,"E6":108,"B0":109,"B2":119,"B3":121,"N1":125,"C1":132,"D1":134,"F0":138,"N9":140,"C2":142,"D2":144,"F1":148,"T0":172,"YW":183,"TS0":197,"TW1":198,"TE1":205,"TC":209,"TN":213,"TW2":214,"TE2":221,"TW3":222,"TE3":229,"TH":244,"YN0":250,"YM1":254,"YM2":258,"YE":262,"POK":266,"YN1":273,"YN2":277,"YS1":287,"YS2":291,"YS3":298}};
const WD={main:16,avenue:26,street:12};
const [LB0,LB1,LB2,LB3]=LAY.bounds; const BX0=LB0-8, BZ0=LB1-8, BX1=LB2+8, BZ1=LB3+8;
const MAP={nodes:LAY.nodes,roads:[],crossings:[],blds:[],parks:[],water:[],poi:{},bounds:[BX0,BZ0,BX1,BZ1]}; window.MAP=MAP;
const NODES=MAP.nodes, ADJ=NODES.map(()=>[]), EDGE={};
const RIV=LAY.river, RIVH=REGION==='sr'?LAY.rivh:REGION==='st'?36:13; const ELEVR=['元朗公路','天水圍路'];
function segDist(px,pz,A,B){ const dx=B[0]-A[0],dz=B[1]-A[1],L2=dx*dx+dz*dz||1; let t=((px-A[0])*dx+(pz-A[1])*dz)/L2; t=Math.max(0,Math.min(1,t)); return Math.hypot(A[0]+dx*t-px,A[1]+dz*t-pz); }
function riverDist(x,z){ let d=1e9; if(RIV[0]&&RIV[0].length>2){   // 沙田實景：河闊度逐點唔同（回傳「同標準闊度比較」嘅距離）
    for(let i=1;i<RIV.length;i++){ const A=RIV[i-1],B=RIV[i],dx=B[0]-A[0],dz=B[1]-A[1],L2=dx*dx+dz*dz||1; let t=((x-A[0])*dx+(z-A[1])*dz)/L2; t=Math.max(0,Math.min(1,t)); d=Math.min(d,Math.hypot(A[0]+dx*t-x,A[1]+dz*t-z)-(A[2]+(B[2]-A[2])*t)+RIVH); } return d; }
  for(let i=1;i<RIV.length;i++) d=Math.min(d,segDist(x,z,RIV[i-1],RIV[i])); return d; }
LAY.edges.forEach(e=>{ const A=NODES[e.a], B=NODES[e.b]; const w=WD[e.t];
  let bridge=false; if(REGION==='sr') bridge=!!e.br; else for(let q=0;q<=10;q++){ if(riverDist(A[0]+(B[0]-A[0])*q/10,A[1]+(B[1]-A[1])*q/10)<RIVH+2){ bridge=true; break; } }
  const r={n:[e.a,e.b],w,t:e.t,name:e.name,bridge,elev:ELEVR.includes(e.name)}; MAP.roads.push(r); const L=Math.hypot(B[0]-A[0],B[1]-A[1]);
  ADJ[e.a].push([e.b,L,r]); ADJ[e.b].push([e.a,L,r]); EDGE[e.a+'-'+e.b]=EDGE[e.b+'-'+e.a]=r; });
const DEG=ADJ.map(a=>a.length);
/* ---------- 元朗公路高架：由 E0 到元朗，兩頭上落斜，中間約 8 米高 ---------- */
// 高架路：元朗公路（兩頭上落斜）、天水圍路（由元朗公路分支，喺天水圍落斜）
function mkElev(st,en,name,rampA){ const E=NODES[en]; let cur=st, prev=-1; const seq=[st];
  for(let g=0;g<300&&cur!==en;g++){ const c=ADJ[cur].filter(([o,,r])=>r.name===name&&o!==prev); if(!c.length) break;
    const dd=k=>Math.hypot(NODES[k][0]-E[0],NODES[k][1]-E[1]); c.sort((p,q)=>dd(p[0])-dd(q[0])); prev=cur; cur=c[0][0]; seq.push(cur); }
  const pts=seq.map(k=>NODES[k]); const cum=[0]; for(let i=1;i<pts.length;i++) cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  const L=cum[cum.length-1], H=8, s0=30, R=75; const hAt=s=>{ const u=Math.min(rampA?(s-s0)/R:9,(L-s0-s)/R); if(u<=0) return 0; if(u>=1) return H; return H*u*u*(3-2*u); };
  let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9; pts.forEach(([x,z])=>{x0=Math.min(x0,x);x1=Math.max(x1,x);z0=Math.min(z0,z);z1=Math.max(z1,z);});
  return {seq,pts,cum,L,H,hAt,bb:[x0-30,z0-30,x1+30,z1+30],rad:12.4}; }
const HWS=REGION==='tm'?[mkElev(LAY.J.E0,LAY.J.YW,'元朗公路',true),mkElev(LAY.J.T0,LAY.J.TS0,'天水圍路',false)]:[];
function elev1(T,x,z,rad){ const b=T.bb; if(x<b[0]||x>b[2]||z<b[1]||z>b[3]) return 0; rad=rad||T.rad; let best=1e9,bs=0;
  for(let i=1;i<T.pts.length;i++){ const A=T.pts[i-1],B=T.pts[i], dx=B[0]-A[0], dz=B[1]-A[1], L2=dx*dx+dz*dz||1; let t=((x-A[0])*dx+(z-A[1])*dz)/L2; t=t<0?0:t>1?1:t;
    const ex=x-A[0]-dx*t, ez=z-A[1]-dz*t, d=ex*ex+ez*ez; if(d<best){ best=d; bs=T.cum[i-1]+t*(T.cum[i]-T.cum[i-1]); } }
  return best<=rad*rad?T.hAt(bs):0; }
function ELEV(x,z,rad){ let m=0; for(const T of HWS){ const a=elev1(T,x,z,rad); if(a>m) m=a; } return m; }
window.ELEV=ELEV;
const inTSW=(x,z)=>REGION==='tm'&&x>120&&x<425&&z<-835&&z>-1085;   // 天水圍市區
const rural=(x,z)=>REGION!=='tm'?false:!inTSW(x,z)&&!(x<240&&z>-440)&&!(x>430&&z<-540);   // 屯門、元朗、天水圍市區以外：郊區
let northWild=(x,z)=>REGION==='tm'&&z<-840&&!inTSW(x,z);   // 新加嘅北面（天水圍以外）：魚塘同濕地，唔起樓
const SIGNAL=DEG.map((d,k)=>d>=3&&ELEV(NODES[k][0],NODES[k][1])<0.5);
const CLR=ADJ.map((a,k)=>DEG[k]>=3?Math.max(...a.map(e=>e[2].w/2))+1.5:0);   // 路口半徑（停車線之前）
const NW=ADJ.map(a=>Math.max(...a.map(e=>e[2].w/2)));                        // 路口填色半徑
const angOf=(A,B)=>Math.atan2(B[0]-A[0],B[1]-A[1]);
const REF=ADJ.map((a,k)=>a.length?angOf(NODES[k],NODES[a[0][0]]):0);

/* ---------- 格網：1 路、2 建築、4 水、8 預留、16 行人路 ---------- */
const X0=BX0-60,Z0=BZ0-60, CELL=2, GW=Math.ceil((BX1+60-X0)/CELL), GH=Math.ceil((BZ1+60-Z0)/CELL);
const grid=new Uint8Array(GW*GH);
const gi=(x,z)=>{const i=Math.floor((x-X0)/CELL), j=Math.floor((z-Z0)/CELL); return (i<0||j<0||i>=GW||j>=GH)?-1:j*GW+i;};
const cellAt=(x,z)=>{const k=gi(x,z); return k<0?2:grid[k];};
// 樓宇碰撞要準：格仔（2 米）只係粗略標記；有樓宇多邊形嘅格，再用多邊形（外擴 0.25 米）判斷，唔會喺牆前一兩米就撞到「空氣牆」
const BIDX=new Map(), OTH=new Uint8Array(GW*GH);
function solidAt(x,z){ const k=gi(x,z); if(k<0) return true; if(!(grid[k]&2)) return false; if(OTH[k]) return true; const a=BIDX.get(k); if(!a) return true; for(const c of a) if(inQuad(x,z,c)) return true; return false; }
const blockedAt=(x,z,mask)=>{ const g=cellAt(x,z); if(g&mask&4) return true; return !!(g&mask&2)&&solidAt(x,z); };
function markSeg(A,B,w,bit,clear=0){ const r=w/2, minx=Math.min(A[0],B[0])-r, maxx=Math.max(A[0],B[0])+r, minz=Math.min(A[1],B[1])-r, maxz=Math.max(A[1],B[1])+r;
  for(let z=minz;z<=maxz+CELL;z+=CELL) for(let x=minx;x<=maxx+CELL;x+=CELL){ const cx=Math.floor((x-X0)/CELL)*CELL+X0+1, cz=Math.floor((z-Z0)/CELL)*CELL+Z0+1;
    if(segDist(cx,cz,A,B)<=r){ const k=gi(cx,cz); if(k>=0){ grid[k]&=~clear; grid[k]|=bit; if(bit&2) OTH[k]=1; } } } }
function inQuad(x,z,c){ let s=0; for(let i=0;i<4;i++){ const A=c[i],B=c[(i+1)%4]; const cr=(B[0]-A[0])*(z-A[1])-(B[1]-A[1])*(x-A[0]); if(cr>0) s|=1; else if(cr<0) s|=2; } return s!==3; }
function quadCells(c,fn,margin=0){ let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9; c.forEach(([x,z])=>{x0=Math.min(x0,x);x1=Math.max(x1,x);z0=Math.min(z0,z);z1=Math.max(z1,z);});
  const cx=(c[0][0]+c[2][0])/2, cz=(c[0][1]+c[2][1])/2; const cc=margin?c.map(([x,z])=>{ const dx=x-cx,dz=z-cz,L=Math.hypot(dx,dz)||1; return [x+dx/L*margin,z+dz/L*margin]; }):c;
  for(let z=z0-margin;z<=z1+margin;z+=CELL/2) for(let x=x0-margin;x<=x1+margin;x+=CELL/2) if(inQuad(x,z,cc)){ if(fn(gi(x,z))===false) return false; } return true; }
const quadFree=(c,margin=1)=>quadCells(c,k=>!(k<0||grid[k]),margin);
const markQuad=(c,bit)=>quadCells(c,k=>{ if(k>=0) grid[k]|=bit; });
// 邊界外面當障礙
for(let j=0;j<GH;j++) for(let i=0;i<GW;i++){ const x=X0+i*CELL+1, z=Z0+j*CELL+1; if(x<BX0||x>BX1||z<BZ0||z>BZ1){ grid[j*GW+i]|=2; OTH[j*GW+i]=1; } }
// 河（沙田實景：用真實水面多邊形）
const WPIP=(x,z,P)=>{ let c=false; for(let i=0,j=P.length-1;i<P.length;j=i++){ const xi=P[i][0],zi=P[i][1],xj=P[j][0],zj=P[j][1]; if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi) c=!c; } return c; };
if(REGION==='sr') LAY.wpoly.forEach(P=>{ let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9; P.forEach(([x,z])=>{x0=Math.min(x0,x);x1=Math.max(x1,x);z0=Math.min(z0,z);z1=Math.max(z1,z);});
  for(let z=Math.floor(z0/CELL)*CELL+1;z<=z1;z+=CELL) for(let x=Math.floor(x0/CELL)*CELL+1;x<=x1;x+=CELL) if(WPIP(x,z,P)){ const k=gi(x,z); if(k>=0) grid[k]|=4; } });
else for(let i=1;i<RIV.length;i++) markSeg(RIV[i-1],RIV[i],RIVH*2,4);
// 湖（公園）
const LAKE=LAY.lake; { let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9; LAKE.forEach(([x,z])=>{x0=Math.min(x0,x);x1=Math.max(x1,x);z0=Math.min(z0,z);z1=Math.max(z1,z);});
  const inP=(x,z)=>{let c=false;for(let i=0,j=LAKE.length-1;i<LAKE.length;j=i++){const [xi,zi]=LAKE[i],[xj,zj]=LAKE[j]; if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)c=!c;}return c;};
  for(let z=z0;z<=z1;z+=CELL) for(let x=x0;x<=x1;x+=CELL) if(inP(x,z)){ const k=gi(x,z); if(k>=0) grid[k]|=4; } }
// 行人路、路面
MAP.roads.forEach(r=>{ const A=NODES[r.n[0]],B=NODES[r.n[1]]; if(!r.bridge) markSeg(A,B,r.w+7.2,16); });
NODES.forEach((N,k)=>{ if(DEG[k]) markSeg(N,N,(NW[k]+3.6)*2,16); });
MAP.roads.forEach(r=>{ const A=NODES[r.n[0]],B=NODES[r.n[1]]; markSeg(A,B,r.w,1,4|16); });
NODES.forEach((N,k)=>{ if(DEG[k]) markSeg(N,N,NW[k]*2,1,4|16); });

/* ---------- 地面、河、路 ---------- */
{ const g=add(new THREE.PlaneGeometry(BX1-BX0+900,BZ1-BZ0+900),M(0xcfe6b8,{r:0.95}),scene,(BX0+BX1)/2,-0.05,(BZ0+BZ1)/2,false); g.rotation.x=-Math.PI/2; }
if(REGION==='sr'){ const bank=[], water=[]; LAY.wpoly.forEach(P=>{ if(P.length<3) return; THREE.ShapeUtils.triangulateShape(P.map(p=>new THREE.Vector2(p[0],p[1])),[]).forEach(([a,b,c])=>water.push(P[a][0],0,P[a][1],P[b][0],0,P[b][1],P[c][0],0,P[c][1]));
    for(let i=0;i<P.length;i++) ribbon(bank,P[i],P[(i+1)%P.length],2.4); MAP.water.push(P); });
  flat(bank,M(0xb9c7a8,{r:0.95}),0.0); flat(water,M(0x6cc2ec,{r:0.25}),0.03); }
else { const bank=[], water=[]; for(let i=1;i<RIV.length;i++){ ribbon(bank,RIV[i-1],RIV[i],RIVH+4); ribbon(water,RIV[i-1],RIV[i],RIVH); }
  RIV.forEach(p=>{ disc(bank,p,RIVH+4,12); disc(water,p,RIVH,12); });
  flat(bank,M(0xb9c7a8,{r:0.95}),0.0); flat(water,M(0x6cc2ec,{r:0.25}),0.03);
  const lake=[]; for(let i=1;i<LAKE.length-1;i++) lake.push(LAKE[0][0],0,LAKE[0][1], LAKE[i][0],0,LAKE[i][1], LAKE[i+1][0],0,LAKE[i+1][1]); flat(lake,M(0x7ec8f0,{r:0.3}),0.2);
  // 小地圖用：河嘅多邊形
  const Lp=[],Rp=[]; for(let i=0;i<RIV.length;i++){ const A=RIV[Math.max(0,i-1)],B=RIV[Math.min(RIV.length-1,i+1)]; const dx=B[0]-A[0],dz=B[1]-A[1],L=Math.hypot(dx,dz)||1;
    Lp.push([RIV[i][0]+dz/L*RIVH,RIV[i][1]-dx/L*RIVH]); Rp.push([RIV[i][0]-dz/L*RIVH,RIV[i][1]+dx/L*RIVH]); }
  MAP.water.push([...Lp,...Rp.reverse()], LAKE); }
// 高架路：路面切成 4 米一段，跟住斜坡弧度；斜坡上嘅節點唔畫圓盤（否則圓盤邊會凸出路面）
const dirn=(A,B)=>{ const dx=B[0]-A[0],dz=B[1]-A[1],L=Math.hypot(dx,dz)||1; return [dx/L,dz/L,L]; };
const onRamp=k=>ADJ[k].some(e=>e[2].elev)&&(h=>h>0.03&&h<7.97)(ELEV(NODES[k][0],NODES[k][1]));
function elevPieces(A,B,step,fn){ const dx=B[0]-A[0],dz=B[1]-A[1],L=Math.hypot(dx,dz)||1, n=Math.max(1,Math.ceil(L/step));
  for(let i=0;i<n;i++){ const t0=i/n, t1=(i+1)/n; fn([A[0]+dx*t0,A[1]+dz*t0],[A[0]+dx*t1,A[1]+dz*t1],i,n,L/n); } }
{ const walk=[], road=[]; MAP.roads.forEach(r=>{ const A=NODES[r.n[0]],B=NODES[r.n[1]];
    if(!r.elev){ ribbon(walk,A,B,r.w/2+3.6); ribbon(road,A,B,r.w/2); return; }
    const [ux,uz]=dirn(A,B); elevPieces(A,B,4,(P,Q,i,n)=>{ const e0=i===0?0.6:0, e1=i===n-1?0.6:0; const P2=[P[0]-ux*e0,P[1]-uz*e0], Q2=[Q[0]+ux*e1,Q[1]+uz*e1];
      ribbon(walk,P2,Q2,r.w/2+3.6); ribbon(road,P2,Q2,r.w/2); }); });
  NODES.forEach((N,k)=>{ if(!DEG[k]||onRamp(k)) return; disc(walk,N,NW[k]+3.6,20); disc(road,N,NW[k],20); });
  flat(walk,PCB?PCB.walkMat():new THREE.MeshStandardMaterial({map:walkTex,roughness:0.9}),0.10); flat(road,PCB?PCB.roadMat():M(C.road,{r:0.85}),0.14); }
// 標線、斑馬線、輕鐵路軌
const mW=[], mY=[], mR=[];
MAP.roads.forEach(r=>{ const [a,b]=r.n, A=NODES[a], B=NODES[b]; const [ux,uz,L]=dirn(A,B); const nx=uz, nz=-ux;
  const s0=DEG[a]>=3?CLR[a]+4.5:0, s1=L-(DEG[b]>=3?CLR[b]+4.5:0);
  const P=s=>[A[0]+ux*s,A[1]+uz*s];
  const line=(arr,o,hw,dash)=>{ const solid=r.elev?4:1e9; for(let s=s0;s<s1-0.5;s+=dash?8:solid){ const e=Math.min(s1,s+(dash?4:solid)); const p=P(s), q=P(e);
      arr.push(p[0]+nx*(o+hw),0,p[1]+nz*(o+hw), q[0]+nx*(o+hw),0,q[1]+nz*(o+hw), q[0]+nx*(o-hw),0,q[1]+nz*(o-hw),  p[0]+nx*(o+hw),0,p[1]+nz*(o+hw), q[0]+nx*(o-hw),0,q[1]+nz*(o-hw), p[0]+nx*(o-hw),0,p[1]+nz*(o-hw)); } };
  if(REGION!=='tm'){ // 沙田冇輕鐵：用返正常分隔線——中間雙黃線、行車線虛線、路邊白實線
    const ew=r.w/2-0.6;
    if(r.t==='avenue'){ line(mY,0.3,0.12,false); line(mY,-0.3,0.12,false); line(mW,6.5,0.12,true); line(mW,-6.5,0.12,true); }
    else if(r.t==='main'){ line(mY,0.25,0.12,false); line(mY,-0.25,0.12,false); }
    else line(mW,0,0.13,true);
    if(!r.bridge||r.t!=='street'){ line(mW,ew,0.1,false); line(mW,-ew,0.1,false); } }
  else {
  if(r.t==='avenue'){ line(mY,6.1,0.15,false); line(mY,-6.1,0.15,false);
    [-3.2,3.2].forEach(o=>[-0.7,0.7].forEach(q=>{ const p=A,q2=B; mR.push(p[0]+nx*(o+q+0.1),0,p[1]+nz*(o+q+0.1), q2[0]+nx*(o+q+0.1),0,q2[1]+nz*(o+q+0.1), q2[0]+nx*(o+q-0.1),0,q2[1]+nz*(o+q-0.1), p[0]+nx*(o+q+0.1),0,p[1]+nz*(o+q+0.1), q2[0]+nx*(o+q-0.1),0,q2[1]+nz*(o+q-0.1), p[0]+nx*(o+q-0.1),0,p[1]+nz*(o+q-0.1)); })); }
  else line(r.t==='main'?mY:mW,0,0.18,r.t!=='main');
  }
  // 斑馬線：喺有燈路口嘅每條入口
  [[a,0,1],[b,L,-1]].forEach(([k,sb,sg])=>{ if(!SIGNAL[k]) return; const s=sb+sg*(CLR[k]+0.6), s2=s+sg*3; const hw=r.w/2;
    for(let o=-hw+0.9;o<=hw-0.9;o+=1.6){ const p=P(s), q=P(s2); quadA(mW,[[p[0]+nx*(o-0.5),p[1]+nz*(o-0.5)],[q[0]+nx*(o-0.5),q[1]+nz*(o-0.5)],[q[0]+nx*(o+0.5),q[1]+nz*(o+0.5)],[p[0]+nx*(o+0.5),p[1]+nz*(o+0.5)]]); }
    const m=P(s+sg*1.5); MAP.crossings.push({p:m,n:[nx,nz],half:hw+2.6,node:k,ang:Math.atan2(ux,uz)}); });
});
flat(mW,new THREE.MeshBasicMaterial({color:0xffffff}),0.17); flat(mY,new THREE.MeshBasicMaterial({color:0xffd23f}),0.17); flat(mR,new THREE.MeshBasicMaterial({color:0x50535a}),0.18);
// 橋欄杆
// 只喺真正跨過河嘅位置起欄杆，而且唔會伸入其他馬路
const railMat=M(0xf1f3f5);
MAP.roads.forEach(r=>{ if(!r.bridge) return; const A=NODES[r.n[0]],B=NODES[r.n[1]]; const [ux,uz,L]=dirn(A,B);
  [-1,1].forEach(sd=>{ const o=(r.w/2+3.4)*sd; let run=null; const flush=()=>{ if(run&&run[1]-run[0]>=2){ const s0=run[0],s1=run[1], m=add(new THREE.BoxGeometry(0.45,1.1,s1-s0),railMat,scene,A[0]+ux*(s0+s1)/2+uz*o,0.7,A[1]+uz*(s0+s1)/2-ux*o,true); m.rotation.y=Math.atan2(ux,uz); } run=null; };
    for(let s=0;s<=L;s+=1){ const x=A[0]+ux*s+uz*o, z=A[1]+uz*s-ux*o; const ok=!(cellAt(x,z)&1)&&riverDist(x,z)<RIVH+5&&!(cellAt(x+ux*1.5,z+uz*1.5)&1)&&!(cellAt(x-ux*1.5,z-uz*1.5)&1);
      if(ok){ if(!run) run=[s,s]; run[1]=s+1; } else flush(); } flush(); }); });

/* ---------- 地標 ---------- */
// 高架橋身：橋面、兩邊石壆、橋躉（建好之後一齊抬高）
{ const deck=M(0xb9bec6,{r:0.9}), side=M(0x9aa1ab,{r:0.9}), par=M(0xe3e6ea,{r:0.8}), hw=8+3.6;
  const lineDist=(T,x,z)=>{ let d=1e9; for(let i=1;i<T.pts.length;i++) d=Math.min(d,segDist(x,z,T.pts[i-1],T.pts[i])); return d; };
  for(const T of HWS){ const others=HWS.filter(o=>o!==T);
   for(let i=1;i<T.pts.length;i++){ const A=T.pts[i-1],B=T.pts[i]; const h=Math.max(T.hAt(T.cum[i-1]),T.hAt(T.cum[i])); if(h<0.3) continue;
    const [ux,uz,L]=dirn(A,B); const nx=uz, nz=-ux;
    // 4 米一段：橋面同石壆跟住斜坡；分叉位嘅石壆如果伸入另一條高架路面就唔起
    elevPieces(A,B,4,(P0,Q0,k,n,len)=>{ const P=(s,o)=>[P0[0]+ux*s+nx*o,P0[1]+uz*s+nz*o];
      boxQ([P(0,-hw),P(len,-hw),P(len,hw),P(0,hw)],-1.5,0.04,side,deck,8,3);
      [-1,1].forEach(sd=>{ const o=sd*(hw+0.2), m=P(len/2,o); if(others.some(O=>lineDist(O,m[0],m[1])<hw+0.6)) return;
        boxQ([P(0,o-0.35),P(len,o-0.35),P(len,o+0.35),P(0,o+0.35)],0.2,1.4,par,par,8,3); }); });
    const Pm=(s,o)=>[A[0]+ux*s+nx*o,A[1]+uz*s+nz*o];
    const hm=T.hAt(T.cum[i-1]+L/2); if(hm>3) for(const o of [-5,5]) boxQ([Pm(L/2-1.3,o-1.3),Pm(L/2+1.3,o-1.3),Pm(L/2+1.3,o+1.3),Pm(L/2-1.3,o+1.3)],-hm,-1.5,side,side,4,4); } } }
const props={tree:[],lamp:[],rail:[],bin:[]}; const signs=[]; const parked=[];
function labelPlane(text,x,y,z,ry,bg,w=14,parent=scene){ const t=canvasTex(512,128,(g)=>{ g.fillStyle=bg; rr(g,4,4,504,120,24); g.fill(); g.fillStyle='#fff'; g.font='bold 72px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(text,256,68); },false);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,w/4),new THREE.MeshBasicMaterial({map:t})); m.position.set(x,y,z); m.rotation.y=ry; parent.add(m); return m; }
// 非樓宇但係有實物嘅障礙（泊咗嘅車、輕鐵月台）：一樣用多邊形判斷
function markPoly(c){ const cx=(c[0][0]+c[2][0])/2, cz=(c[0][1]+c[2][1])/2, cc=c.map(([x,z])=>{ const dx=x-cx,dz=z-cz,L=Math.hypot(dx,dz)||1; return [x+dx/L*0.25,z+dz/L*0.25]; });
  quadCells(c,k=>{ if(k<0) return; if((grid[k]&2)&&!BIDX.has(k)) OTH[k]=1; grid[k]|=2; let a=BIDX.get(k); if(!a) BIDX.set(k,a=[]); a.push(cc); }); }
const markRect=(p,a,w,l)=>{ const fx=Math.sin(a),fz=Math.cos(a),rx=fz,rz=-fx, hw=w/2, hl=l/2; markPoly([[p[0]-rx*hw-fx*hl,p[1]-rz*hw-fz*hl],[p[0]+rx*hw-fx*hl,p[1]+rz*hw-fz*hl],[p[0]+rx*hw+fx*hl,p[1]+rz*hw+fz*hl],[p[0]-rx*hw+fx*hl,p[1]-rz*hw+fz*hl]]); };
function addBldQ(c,h,lm){ MAP.blds.push({p:c,h,lm}); const cx=(c[0][0]+c[2][0])/2, cz=(c[0][1]+c[2][1])/2, cc=c.map(([x,z])=>{ const dx=x-cx,dz=z-cz,L=Math.hypot(dx,dz)||1; return [x+dx/L*0.35,z+dz/L*0.35]; });
  quadCells(c,k=>{ if(k<0) return; if((grid[k]&2)&&!BIDX.has(k)) OTH[k]=1; grid[k]|=2; let a=BIDX.get(k); if(!a) BIDX.set(k,a=[]); if(!a.includes(cc)) a.push(cc); }); }
// 搵最近（唔係橋）嘅路段
function nearestEdge(x,z,filter){ let best=null; MAP.roads.forEach(r=>{ if(r.bridge||(filter&&!filter(r))) return; const A=NODES[r.n[0]],B=NODES[r.n[1]]; const d=segDist(x,z,A,B); if(!best||d<best.d) best={r,d}; });
  const r=best.r, A=NODES[r.n[0]],B=NODES[r.n[1]]; const [ux,uz,L]=dirn(A,B); let t=((x-A[0])*ux+(z-A[1])*uz); t=Math.max(6,Math.min(L-6,t));
  const R=[A[0]+ux*t,A[1]+uz*t]; let nx=uz, nz=-ux; if((x-R[0])*nx+(z-R[1])*nz<0){ nx=-nx; nz=-nz; } return {r,R,nx,nz}; }
// 地標框：原點喺行人路後面，+z（局部）= 遠離馬路，+x（局部）= (nz,-nx)
function frameAt(R,nx,nz,off){ const F=[R[0]+nx*off,R[1]+nz*off], ux=nz, uz=-nx; const L=(lx,lz)=>[F[0]+ux*lx+nx*lz,F[1]+uz*lx+nz*lz];
  const g=new THREE.Group(); g.position.set(F[0],0,F[1]); g.rotation.y=Math.atan2(nx,nz); scene.add(g);
  const rq=(x0,z0,x1,z1)=>[L(x0,z0),L(x1,z0),L(x1,z1),L(x0,z1)]; return {F,L,g,rq,nx,nz,ux,uz,off}; }
function placeLM(px,pz,w,d,filter){ // 沿住條路前後試位置，直到成塊地唔壓到其他馬路、河或者其他地標
  let E0=nearestEdge(px,pz,filter), pick0=null;
  for(const k of [0,8,-8,16,-16,24,-24,32,-32,44,-44,56,-56]){ const ux=E0.nz, uz=-E0.nx; const E=nearestEdge(px-ux*k,pz-uz*k,filter); const off=E.r.w/2+3.6+0.4;
    const F=[E.R[0]+E.nx*off,E.R[1]+E.nz*off], Lx=(lx,lz)=>[F[0]+E.nz*lx+E.nx*lz,F[1]-E.nx*lx+E.nz*lz];
    const ok=quadCells([Lx(-w/2,1),Lx(w/2,1),Lx(w/2,d),Lx(-w/2,d)],q=>!(q<0||(grid[q]&(1|4|8))));
    if(ok){ pick0=E; break; } }
  if(!pick0) console.warn('placeLM: 搵唔到空位',px,pz);
  const E=pick0||E0; const off=E.r.w/2+3.6+0.4; const f=frameAt(E.R,E.nx,E.nz,off); f.E=E;
  markQuad(f.rq(-w/2-2,-2,w/2+2,d+2),8); boxQ(f.rq(-w/2,0,w/2,d),0,0.32,lotMat,lotMat); return f; }
// 停車位：喺地標嗰邊嘅行車線
const laneOff=r=>r.t==='avenue'?8.6:r.w/4;
function curbStop(f,lx){ const o=f.off-laneOff(f.E.r); return f.L(lx,-o); }
const LMK={};
const S2=LAY.S; const RP=(x,z)=>[x*S2,z*S2]; // 真實坐標 → 遊戲坐標

// 醫院：喺路盡頭（屯門醫院：青松觀路北；博愛醫院：坳頭路）
function buildHosp(key,name,c1,c2){ const k=LAY.J[key], N=NODES[k], P0=NODES[ADJ[k][0][0]]; const [dx,dz]=dirn(P0,N); const f=frameAt(N,dx,dz,4);
  const w=120,d=80; markQuad(f.rq(-w/2-2,-4,w/2+2,d+2),8); boxQ(f.rq(-w/2,0,w/2,d),0,0.3,walkMat,walkMat);
  markQuad(f.rq(-16,-4,16,26),1);  // 車道當路面
  boxQ(f.rq(-16,0,16,26),0,0.33,M(0xa9b0ba,{r:0.9}),M(0xa9b0ba,{r:0.9}));
  const hm=texMat('hosp'+key,housingTex(c1[0],c1[1],2)), hm2=texMat('hosp2'+key,housingTex(c2[0],c2[1],1));
  let c=f.rq(-50,26,50,40); boxQ(c,0.3,12,hm2,M(0xd62839),8,3); addBldQ(c,12,'hospital');
  c=f.rq(-54,44,-6,76); boxQ(c,0.3,34,hm,roofMat,8,3); addBldQ(c,34,'hospital');
  c=f.rq(4,46,54,76); boxQ(c,0.3,26,hm,roofMat,8,3); addBldQ(c,26,'hospital');
  add(new THREE.CylinderGeometry(8,8,0.4,32),M(0x58606b),f.g,-30,34.5,60,false);
  labelPlane('H',-30,34.75,60,0,'#58606b',9,f.g).rotation.x=-Math.PI/2;
  labelPlane(name,-30,22,43.9,Math.PI,'#d62839',22,f.g);
  add(new THREE.BoxGeometry(26,0.6,11),M(0x8fd3c7),f.g,0,5.2,20.5,true);
  [-12,12].forEach(o=>add(new THREE.CylinderGeometry(0.35,0.35,5,10),M(0xd0d4da),f.g,o,2.6,15.5,true));
  labelPlane('急症室 A&E',0,8.4,25.9,Math.PI,'#d62839',18,f.g);
  MAP.poi.ae=(MAP.poi.ae||[]).concat([f.L(0,26)]);
  return {door:f.L(0,24.5),stop:f.L(0,13),poi:f.L(0,50)};
}
if(REGION==='tm'){ LMK.ae=buildHosp('HOSP','屯門醫院',['#e3f4f1','#2a9d8f'],['#fde8e8','#d62839']); MAP.poi.hospital=LMK.ae.poi;
LMK.ae2=buildHosp('POK','博愛醫院',['#f3efe6','#b5651d'],['#fff1e0','#c0392b']); MAP.poi.hospital2=LMK.ae2.poi; }
// 救護站（屯門：震寰路；元朗：擊壤路）
function buildDepot(f,zh,en,addr,key,sc=1){
  if(sc!==1){ const f0=f, g2=new THREE.Group(); g2.scale.set(sc,1,sc); f0.g.add(g2);   // 細啲嘅救護站（沙田實景：地方窄）
    f=Object.assign({},f0,{g:g2,L:(x,z)=>f0.L(x*sc,z*sc),rq:(a,b,c,d)=>f0.rq(a*sc,b*sc,c*sc,d*sc)}); }
  // 外觀跟真實屯門救護站：米色混凝土平房、紅色摺門、紅字招牌、門柱黃黑間條、射燈
  const dm=texMat('depot'+key,canvasTex(256,128,(g,w,h)=>{ g.fillStyle='#d9d1bc'; g.fillRect(0,0,w,h); g.fillStyle='rgba(120,110,90,.10)'; for(let i=0;i<14;i++) g.fillRect(Math.random()*w,Math.random()*h,2+Math.random()*30,1+Math.random()*3);
    g.fillStyle='#c9c0a8'; g.fillRect(0,0,w,6); }));
  const roofM=M(0xbdb5a0,{r:0.95}), H=8;
  const BX=-5.4, B0=BX-4.4, B1=BX+4.4;
  [[-26,16,B0,38],[B1,16,26,38],[B0,33,B1,38]].forEach(([a,b,cc,d])=>{ const q=f.rq(a,b,cc,d); boxQ(q,0.3,H,dm,roofM,8,4); addBldQ(q,H,'depot'); });
  boxQ(f.rq(B0,16,B1,33),6.4,H,dm,roofM,8,4);                            // 車房門頂
  boxQ(f.rq(B0,16,B1,33),0.3,0.34,M(0x8a4b3a),M(0x8a4b3a));              // 車房地台（紅啡色）
  { const pl=new THREE.PointLight(0xfff2cc,0.6,14); pl.position.set(BX,5.5,24); f.g.add(pl); }
  boxQ(f.rq(-26.3,15.7,26.3,38.3),H,H+0.5,dm,roofM,8,4);                 // 天台矮牆
  // 紅色摺門
  const doorT=canvasTex(256,192,(g,w,h)=>{ for(let i=0;i<16;i++){ g.fillStyle=i%2?'#b8434f':'#c95560'; g.fillRect(i*16,0,16,h); g.fillStyle='rgba(0,0,0,.18)'; g.fillRect(i*16+14,0,2,h); }
    g.fillStyle='#ffffff'; g.font='bold 18px sans-serif'; g.textAlign='center'; g.fillText('CAUTION FOLDING DOOR',w/2,112); g.font='bold 26px sans-serif'; g.fillText('小心摺門',w/2,146); },false);
  const doorM=new THREE.MeshStandardMaterial({map:doorT,roughness:0.7});
  const hazT=canvasTex(32,128,(g,w,h)=>{ g.fillStyle='#d9d1bc'; g.fillRect(0,0,w,h); for(let i=0;i<8;i++){ g.fillStyle=i%2?'#1c1c1c':'#f2c200'; g.fillRect(10,64+i*8,12,8); } },false);
  const pilM=new THREE.MeshStandardMaterial({map:hazT,roughness:0.9});
  for(let k=0;k<4;k++){ const x=-16+k*10.6; if(Math.abs(x-BX)<1){ // 打開咗嗰個車位：摺門摺埋喺兩邊
      [-1,1].forEach(s=>add(new THREE.BoxGeometry(1.0,6.1,0.9),M(0xb8434f),f.g,x+s*3.7,3.35,16.6,false)); continue; }
    const d=new THREE.Mesh(new THREE.PlaneGeometry(8.6,6.1),doorM); d.position.set(x,3.35,15.92); d.rotation.y=Math.PI; f.g.add(d); }
  for(let k=0;k<5;k++){ const x=-21.3+k*10.6; add(new THREE.BoxGeometry(1.6,6.4,0.6),dm,f.g,x,3.5,15.7,true);
    const p=new THREE.Mesh(new THREE.PlaneGeometry(1.6,6.4),pilM); p.position.set(x,3.5,15.38); p.rotation.y=Math.PI; f.g.add(p); }
  // 招牌：米色牆身上嘅紅字
  { const t=canvasTex(1024,128,(g,w,h)=>{ g.fillStyle='#d9d1bc'; g.fillRect(0,0,w,h); g.fillStyle='#c4202f'; g.textAlign='center'; g.textBaseline='middle';
      g.font='bold 54px sans-serif'; g.fillText(zh,w/2,34); g.font='bold '+(en.length>24?44:50)+'px sans-serif'; g.fillText(en,w/2,96); },false);
    const s=new THREE.Mesh(new THREE.PlaneGeometry(17,2.1),new THREE.MeshStandardMaterial({map:t,roughness:0.9})); s.position.set(-2,7.45,15.66); s.rotation.y=Math.PI; f.g.add(s);
    const t2=canvasTex(256,32,(g,w,h)=>{ g.fillStyle='#d9d1bc'; g.fillRect(0,0,w,h); g.fillStyle='#c4202f'; g.font='bold 22px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(addr,w/2,17); },false);
    const s2=new THREE.Mesh(new THREE.PlaneGeometry(8,1),new THREE.MeshStandardMaterial({map:t2})); s2.position.set(16,7.6,15.66); s2.rotation.y=Math.PI; f.g.add(s2); }
  // 射燈
  [12,-8].forEach(x=>{ const l=add(new THREE.BoxGeometry(1.6,0.7,0.9),M(0x8c9196),f.g,x,H+0.9,15.4,false); l.rotation.x=0.5; add(new THREE.BoxGeometry(1.3,0.45,0.05),M(0xfff6d0,{e:0x666655}),f.g,x,H+0.75,14.95,false); });
  // 門口盆栽
  for(let k=0;k<4;k++){ add(new THREE.CylinderGeometry(0.9,0.7,0.8,10),M(0xd8cfc2),f.g,-24+k*1.9,0.75,10,false); add(new THREE.SphereGeometry(1.1,8,6),M(0x4f9a45),f.g,-24+k*1.9,1.9,10,false); }
  markSeg(f.L(-21,10),f.L(-18.3,10),2.4,2);
  const face=Math.atan2(-f.nx,-f.nz);
  return {pos:f.L(BX,25),a:face,face,f}; }   // 開波時喺車房入面，車頭向住馬路
/* ---------- 沙田區救護站、消防局：跟真實相片砌外觀 ---------- */
// 縮細（只係平面方向，高度唔變）：沙田實景地圖地方窄
// 由馬路望入去：設計坐標 x 正數 = 畫面右邊（地標框本身 +x 喺畫面左邊，所以要左右對調）
const SX=v=>-v;
function scaleFrame(f,sc){ const f0=f, g2=new THREE.Group(); g2.scale.set(sc,1,sc); f0.g.add(g2);
  return Object.assign({},f0,{g:g2,L:(x,z)=>f0.L(-x*sc,z*sc),rq:(a,b,c,d)=>f0.rq(-c*sc,b*sc,-a*sc,d*sc)}); }
// 喺另一個地標隔籬起（沿同一條路，左右揀有空位嗰邊）
function placeBeside(f0,halfW0,w,d,pref=1){ for(const sd of [pref,-pref]) for(const gap of [5,9,14,20]){ const C=f0.L(sd*(halfW0+w/2+gap),0); const g=frameAt(C,f0.nx,f0.nz,0);
    const ok=quadCells([g.L(-w/2,1),g.L(w/2,1),g.L(w/2,d),g.L(-w/2,d)],q=>!(q<0||(grid[q]&(1|4|8))));
    if(ok){ g.E=f0.E; markQuad(g.rq(-w/2-2,-2,w/2+2,d+2),8); boxQ(g.rq(-w/2,0,w/2,d),0,0.32,lotMat,lotMat); return g; } scene.remove(g.g); }
  return null; }
// 喺另一個地標後面起（背對背，正面向另一邊條路）
function placeBehind(f0,d0,w,d){ for(const gap of [1.5,4,7]){ const C=f0.L(0,d0+d+gap); const g=frameAt(C,-f0.nx,-f0.nz,0);
    const ok=quadCells([g.L(-w/2,0),g.L(w/2,0),g.L(w/2,d),g.L(-w/2,d)],q=>!(q<0||(grid[q]&(1|4))));
    if(ok){ g.E=f0.E; markQuad(g.rq(-w/2-1,-1,w/2+1,d),8); boxQ(g.rq(-w/2,0,w/2,d),0,0.32,lotMat,lotMat); return g; } scene.remove(g.g); }
  return null; }
// 牆上凸字招牌（米色／白色底、灰色字），parts：[[字, x 位置(0–1), 字號比例, 對齊]]
function wallText(w,h,bg,col,parts){ return canvasTex(w,h,(g,W,H)=>{ g.fillStyle=bg; g.fillRect(0,0,W,H); g.textBaseline='middle';
  parts.forEach(([t,x,fs,al,y])=>{ g.font='bold '+Math.round(H*fs)+'px "Times New Roman",serif'; g.textAlign=al||'center';
    g.fillStyle='rgba(0,0,0,.22)'; g.fillText(t,x*W+2,(y??0.55)*H+2); g.fillStyle=col; g.fillText(t,x*W,(y??0.55)*H); }); },false); }
function plateAt(parent,tex,w,h,x,y,z,ry=Math.PI){ const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:tex,roughness:0.85})); m.position.set(SX(x),y,z); m.rotation.y=ry; parent.add(m); return m; }
function floodlight(parent,x,y,z){ x=SX(x); const l=add(new THREE.BoxGeometry(1.3,0.6,0.8),M(0x2a2d31),parent,x,y,z,false); l.rotation.x=0.5; add(new THREE.BoxGeometry(1.0,0.4,0.05),M(0xfff6d0,{e:0x55554a}),parent,x,y-0.12,z-0.42,false); }
function foldDoorTex(){ return canvasTex(256,192,(g,w,h)=>{ for(let i=0;i<16;i++){ g.fillStyle=i%2?'#b3252f':'#c8323d'; g.fillRect(i*16,0,16,h); g.fillStyle='rgba(0,0,0,.2)'; g.fillRect(i*16+14,0,2,h); }
  g.fillStyle='#fff'; g.font='bold 16px sans-serif'; g.textAlign='center'; g.fillText('FOLDING DOOR   KEEP CLEAR',w/2,150); g.font='bold 18px sans-serif'; g.fillText('摺動閘門   請勿接近',w/2,172); },false); }

// ===== 沙田救護車站（源禾路，沙田區消防總局隔籬）：單層開放式車房——米色長橫樑灰色凸字、方柱、紅色門框，樑頂射燈 =====
function buildDepotST(f,sc=1,nb=5){ f=scaleFrame(f,sc);
  const BW=8.4, PW=1.4, W=nb*BW+(nb+1)*PW, X0=-W/2, Z0=16, Z1=36, H=5.6, HB=7.8;
  const cream=M(0xefe9db,{r:0.9}), red=M(0xa8202c,{r:0.7}), floor=M(0x95a59c,{r:0.95}), wall=M(0xf4f2ec,{r:0.9});
  const bx=k=>X0+PW+k*(BW+PW)+BW/2;
  boxQ(f.rq(X0,Z0,X0+W,Z1),0.3,0.34,floor,floor);                                   // 車房地台（灰綠色）
  for(let k=0;k<=nb;k++){ const x=X0+k*(BW+PW); const q=f.rq(x,Z0,x+PW,Z0+PW); boxQ(q,0.3,H,cream,cream,4,3); addBldQ(q,H,'depot');   // 前面方柱
    const q2=f.rq(x,Z1-PW,x+PW,Z1); boxQ(q2,0.3,H,cream,cream,4,3); addBldQ(q2,H,'depot'); }
  { const q=f.rq(X0,Z1-0.6,X0+W,Z1); boxQ(q,0.3,H,wall,wall,6,3); addBldQ(q,H,'depot'); }   // 後牆
  [X0,X0+W-0.5].forEach(x=>{ const q=f.rq(x,Z0,x+0.5,Z1); boxQ(q,0.3,H,wall,wall,6,3); addBldQ(q,H,'depot'); });
  boxQ(f.rq(X0-0.3,Z0-0.4,X0+W+0.3,Z1),H,HB,cream,M(0xd3ccbd,{r:0.95}),6,3);            // 樑同天台
  { const c=add(new THREE.PlaneGeometry(W,Z1-Z0),wall,f.g,SX(0),H-0.02,(Z0+Z1)/2,false); c.rotation.x=Math.PI/2; }   // 天花
  // 紅色門框：開口頂一條紅樑、兩邊摺埋嘅紅門
  for(let k=0;k<nb;k++){ add(new THREE.BoxGeometry(BW,1.0,0.7),red,f.g,SX(bx(k)),H-0.5,Z0+0.35,false);
    [-1,1].forEach(s=>add(new THREE.BoxGeometry(0.35,H-1.3,0.9),red,f.g,SX(bx(k)+s*(BW/2-0.2)),(H-1.3)/2+0.3,Z0+0.6,false)); }
  // 招牌：SHA TIN AMBULANCE DEPOT ／ 沙田救護車站
  plateAt(f.g,wallText(2048,96,'#efe9db','#8a867e',[['SHA TIN AMBULANCE DEPOT',0.3,0.42],['沙 田 救 護 車 站',0.76,0.5]]),W+0.6,HB-H,0,(H+HB)/2,Z0-0.42);
  [0.12,0.5,0.86].forEach(t=>floodlight(f.g,X0+W*t,HB+0.45,Z0+0.2));
  // 最左一格係房（白牆、門、窗）
  { const q=f.rq(X0+PW,Z0+4,X0+PW+BW,Z1-0.6); boxQ(q,0.3,H-1.1,texMat('stRoom',canvasTex(128,64,(g,w,h)=>{ g.fillStyle='#f6f5f1'; g.fillRect(0,0,w,h); g.fillStyle='#5b4636'; g.fillRect(14,22,22,42); g.fillStyle='#9db4c4'; g.fillRect(58,18,48,22); g.fillStyle='#c62828'; g.fillRect(70,46,22,10); })),wall,8.4,H-1.4); addBldQ(q,H,'depot'); }
  { const pl=new THREE.PointLight(0xfff2cc,0.55,16); pl.position.set(SX(bx(1)),H-0.8,Z0+8); f.g.add(pl); }
  // 門口矮樹叢
  for(let k=0;k<5;k++) add(new THREE.SphereGeometry(1.1,8,6),M(0x4f8f45),f.g,SX(X0-3+k*1.6),0.9,Z0-1.6,false);
  markSeg(f.L(X0-3,Z0-1.6),f.L(X0+3.4,Z0-1.6),2.4,2);
  const face=Math.atan2(-f.nx,-f.nz), P=1;   // 玩家：第二格
  const parked=[]; for(let k=P+1;k<nb;k++) parked.push([f.L(bx(k),Z0+9),face]);
  return {pos:f.L(bx(P),Z0+9),a:face,face,f,parked}; }

// ===== 田心救護站（富健街2號）：四層白色大樓——赭黃色柱同頂樑、綠玻璃窗帶、四個紅色摺門車位，左邊入口同灰字招牌 =====
function buildDepotTS(f,sc=1){ f=scaleFrame(f,sc);
  const nb=4, BW=7.6, PW=1.3, XL=-24, XB=-11.5, XB1=XB+nb*BW+(nb+1)*PW, Z0=14, Z1=32, G=6.2, F2=13.2, BM=15.2, TOP=18.6;
  const white=M(0xf3f3f0,{r:0.9}), ochre=M(0xd4ad55,{r:0.85});
  const winT=canvasTex(256,128,(g,w,h)=>{ g.fillStyle='#f4f4f1'; g.fillRect(0,0,w,h); g.fillStyle='#e6e6e2'; g.fillRect(0,h*0.78,w,h*0.22);
    g.fillStyle='#7fae9c'; g.fillRect(6,h*0.14,w-12,h*0.56); g.fillStyle='#a9cfc0'; g.fillRect(6,h*0.14,w-12,h*0.12);
    g.fillStyle='#f4f4f1'; for(let x=6;x<w;x+=Math.floor((w-12)/4)) g.fillRect(x-2,h*0.14,5,h*0.56); g.fillRect(6,h*0.42,w-12,4); });
  const winM=new THREE.MeshStandardMaterial({map:winT,roughness:0.6});
  const bx=k=>XB+PW+k*(BW+PW)+BW/2, OPEN=2;
  // 地下：辦公室（左）同車位（開咗嗰格係空心）
  { const q=f.rq(XL,Z0,XB,Z1); boxQ(q,0.3,G,white,white,6,3); addBldQ(q,F2,'depot'); }
  { const a=bx(OPEN)-BW/2, b=bx(OPEN)+BW/2; [[XB,a],[b,XB1]].forEach(([x0,x1])=>{ const q=f.rq(x0,Z0,x1,Z1); boxQ(q,0.3,G,white,white,6,3); addBldQ(q,F2,'depot'); });
    const q=f.rq(a,Z1-0.6,b,Z1); boxQ(q,0.3,G,white,white,6,3); addBldQ(q,G,'depot');
    boxQ(f.rq(a,Z0,b,Z1),0.3,0.34,M(0x8f9a96),M(0x8f9a96));
    const c=add(new THREE.PlaneGeometry(BW,Z1-Z0),white,f.g,SX(bx(OPEN)),G-0.02,(Z0+Z1)/2,false); c.rotation.x=Math.PI/2;
    const pl=new THREE.PointLight(0xfff2cc,0.55,14); pl.position.set(SX(bx(OPEN)),G-1,Z0+8); f.g.add(pl); }
  boxQ(f.rq(XL,Z0,XB1,Z1),G,F2,winM,white,BW+PW,3.5);                               // 一樓、二樓窗帶
  boxQ(f.rq(XL-0.3,Z0-0.8,XB1+0.3,Z1),F2,BM,ochre,M(0xcfcfca),6,2);                  // 赭黃色頂樑
  boxQ(f.rq(XL+1.5,Z0+3,XB1-1.5,Z1-1),BM,TOP,winM,roofMat,BW+PW,3.4);                // 頂層（退後）
  for(let x=XL+1.5;x<=XB1-1.5;x+=2.6) add(new THREE.BoxGeometry(0.1,1.1,0.1),M(0x8c9196),f.g,SX(x),TOP+0.55,Z0+3,false);   // 天台欄杆
  add(new THREE.BoxGeometry(XB1-XL-3,0.1,0.1),M(0x8c9196),f.g,SX((XL+XB1)/2),TOP+1.1,Z0+3,false);
  // 赭黃色柱：車位之間，由地下去到頂樑
  for(let k=0;k<=nb;k++){ const x=XB+k*(BW+PW); boxQ(f.rq(x,Z0-0.5,x+PW,Z0+0.3),0.3,F2,ochre,ochre,2,3); }
  // 紅色摺門（開咗嗰格冇門，兩邊摺埋）
  const doorM=new THREE.MeshStandardMaterial({map:foldDoorTex(),roughness:0.7});
  for(let k=0;k<nb;k++){ if(k===OPEN){ [-1,1].forEach(s=>add(new THREE.BoxGeometry(0.6,G-0.5,0.8),M(0xb3252f),f.g,SX(bx(k)+s*(BW/2-0.35)),(G-0.5)/2+0.3,Z0+0.4,false)); continue; }
    const d=new THREE.Mesh(new THREE.PlaneGeometry(BW,G-0.6),doorM); d.position.set(SX(bx(k)),(G-0.6)/2+0.3,Z0-0.06); d.rotation.y=Math.PI; f.g.add(d); }
  // 左邊入口：啡色門、玻璃壁報板、白色簷篷
  add(new THREE.BoxGeometry(3,2.8,0.1),M(0x6b4a34),f.g,SX(XL+5),1.7,Z0-0.06,false); add(new THREE.BoxGeometry(2.6,2,0.1),M(0x9fb9c8),f.g,SX(XL+8.6),2.1,Z0-0.06,false);
  boxQ(f.rq(XL+2,Z0-2.2,XB-1,Z0),3.4,3.75,white,white);
  // 招牌：TIN SUM AMBULANCE DEPOT／田心救護站（灰色字）、右邊紅色小牌「救護站」
  plateAt(f.g,wallText(1024,256,'#f3f3f0','#8a8780',[['TIN SUM AMBULANCE DEPOT',0.04,0.26,'left',0.3],['田 心 救 護 站',0.04,0.34,'left',0.74]]),11,2.4,XL+6,5.0,Z0-0.08);
  plateAt(f.g,wallText(256,96,'#c62828','#ffffff',[['救 護 站',0.5,0.5]]),2.6,1,XB1+1.4,4.6,Z0-0.08);
  [-6,6,16].forEach(x=>floodlight(f.g,x,G+0.1,Z0-0.4));
  // 冷氣機
  [[XL+3,9.6],[XL+9,9.6],[XB+12,12.4],[XB+22,12.4],[XB1-3,9.6]].forEach(([x,y])=>add(new THREE.BoxGeometry(1.2,0.8,0.5),M(0xe2e4e6),f.g,SX(x),y,Z0-0.25,false));
  // 兩邊高樹
  [XL-3,XB1+3].forEach(x=>{ add(new THREE.CylinderGeometry(0.35,0.45,8,8),M(0x6b4f3a),f.g,SX(x),4,Z0+1,false); add(new THREE.ConeGeometry(2.6,10,9),M(0x2f6b3a),f.g,SX(x),12,Z0+1,false); });
  const face=Math.atan2(-f.nx,-f.nz);
  return {pos:f.L(bx(OPEN),Z0+9),a:face,face,f,parked:[]}; }

// ===== 沙田區消防總局（源禾路26號）：三層米白色大樓——上面兩層密排直條遮陽鰭、地下紅色門框車位、灰字招牌、「FIRE STATION 消防局」燈箱、天台兩支旗 =====
function flagTex(kind){ return canvasTex(192,128,(g,w,h)=>{ g.fillStyle='#de2910'; g.fillRect(0,0,w,h);
  const star=(cx,cy,r,rot,col)=>{ g.fillStyle=col; g.beginPath(); for(let i=0;i<10;i++){ const a=rot+i*Math.PI/5-Math.PI/2, rr=i%2?r*0.38:r; g.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr); } g.closePath(); g.fill(); };
  if(kind==='cn'){ star(32,32,19,0,'#ffde00'); [[64,13],[77,26],[77,45],[64,58]].forEach(([x,y])=>star(x,y,6.5,Math.atan2(32-y,32-x)+Math.PI/2,'#ffde00')); }
  else { const cx=w/2, cy=h/2; for(let i=0;i<5;i++){ const a=i*Math.PI*2/5-Math.PI/2; g.save(); g.translate(cx,cy); g.rotate(a); g.fillStyle='#fff'; g.beginPath(); g.moveTo(0,0); g.bezierCurveTo(18,-8,26,-34,4,-46); g.bezierCurveTo(-2,-30,-12,-14,0,0); g.fill(); star(6,-28,4,0,'#de2910'); g.restore(); } } },false); }
function buildFireST(f,sc=1,nb=5){ f=scaleFrame(f,sc);
  const BW=6.6, PW=1.6, WB=nb*BW+(nb+1)*PW, XR=14, X0=-(WB+XR)/2, XB1=X0+WB, X1=XB1+XR, Z0=8, Z1=28, G=6, F=13.2, PAR=14;
  const cream=M(0xf1ead8,{r:0.9}), red=M(0xb3252f,{r:0.7});
  const pilT=canvasTex(32,128,(g,w,h)=>{ g.fillStyle='#f1ead8'; g.fillRect(0,0,w,h); for(let i=0;i<5;i++){ g.fillStyle=i%2?'#1c1c1c':'#f2c200'; g.fillRect(4,h-36+i*7,w-8,7); } },false);
  const pilM=new THREE.MeshStandardMaterial({map:pilT,roughness:0.9});
  const finT=canvasTex(128,128,(g,w,h)=>{ g.fillStyle='#d8cfb8'; g.fillRect(0,0,w,h); g.fillStyle='#f3ecda'; for(let x=0;x<w;x+=16) g.fillRect(x,0,10,h); g.fillStyle='#4f5b63'; for(let x=12;x<w;x+=32) g.fillRect(x,h*0.25,3,h*0.35); g.fillStyle='#f3ecda'; g.fillRect(0,h*0.47,w,6); g.fillRect(0,h-6,w,6); });
  const finM=new THREE.MeshStandardMaterial({map:finT,roughness:0.85});
  const bx=k=>X0+PW+k*(BW+PW)+BW/2;
  boxQ(f.rq(X0,Z0,XB1,Z1),0.3,0.34,M(0x8d8f8f),M(0x8d8f8f));
  { const q=f.rq(X0,Z1-1,XB1,Z1); boxQ(q,0.3,G,M(0x3b4045),M(0x3b4045),6,3); }   // 車房入面（暗）
  { const c=add(new THREE.PlaneGeometry(WB,Z1-Z0),M(0xd9d4c6),f.g,SX((X0+XB1)/2),G-0.02,(Z0+Z1)/2,false); c.rotation.x=Math.PI/2; }
  for(let k=0;k<=nb;k++){ const x=X0+k*(BW+PW); boxQ(f.rq(x,Z0,x+PW,Z0+PW),0.3,G,pilM,cream,PW,G); }
  for(let k=0;k<nb;k++){ [-1,1].forEach(s=>add(new THREE.BoxGeometry(0.45,G-0.6,1.0),red,f.g,SX(bx(k)+s*(BW/2-0.25)),(G-0.6)/2+0.3,Z0+0.7,false));
    add(new THREE.BoxGeometry(BW,0.5,0.8),red,f.g,SX(bx(k)),G-0.25,Z0+0.5,false);
    if(k%2===0||k===nb-1){ const e=new THREE.Group(); e.position.set(SX(bx(k)),0.3,Z0+9); f.g.add(e);   // 消防車
      add(new THREE.BoxGeometry(2.5,2.6,8),M(0xc1121f),e,0,1.7,0.6,false); add(new THREE.BoxGeometry(2.5,2.0,2.4),M(0xc1121f),e,0,1.6,-4.2,false);
      add(new THREE.BoxGeometry(2.3,0.9,0.1),M(0x1d2a33),e,0,2.1,-5.42,false); add(new THREE.BoxGeometry(2.55,0.25,8),M(0xf5f5f5),e,0,1.2,0.6,false); } }
  addBldQ(f.rq(X0,Z0,XB1,Z1),F,'fire');
  { const q=f.rq(XB1,Z0,X1,Z1); boxQ(q,0.3,G,texMat('fireOff',canvasTex(128,64,(g,w,h)=>{ g.fillStyle='#f1ead8'; g.fillRect(0,0,w,h); g.fillStyle='#24292e'; g.fillRect(8,10,w-16,22); g.fillStyle='#f1ead8'; for(let x=8;x<w;x+=28) g.fillRect(x,10,3,22); })),cream,XR,G); addBldQ(q,F,'fire'); }
  boxQ(f.rq(X0,Z0-0.3,X1,Z1),G,G+1.5,cream,cream,6,1.5);                               // 招牌帶
  boxQ(f.rq(X0,Z0,X1,Z1),G+1.5,F,finM,cream,4.4,(F-G-1.5)/2);                          // 上面兩層（直條遮陽鰭）
  for(let x=X0+1;x<X1-0.5;x+=2.2) add(new THREE.BoxGeometry(0.32,F-G-1.5,0.9),cream,f.g,SX(x),(G+1.5+F)/2,Z0-0.45,false);   // 凸出嘅直條
  boxQ(f.rq(X0-0.2,Z0-0.2,X1+0.2,Z1+0.2),F,PAR,cream,M(0xcfc8b6));                    // 天台矮牆
  plateAt(f.g,wallText(2048,96,'#f1ead8','#8a8378',[['SHA TIN DIVISIONAL FIRE STATION',0.28,0.4],['沙 田 區 消 防 總 局',0.72,0.5]]),X1-X0-2,1.3,(X0+X1)/2,G+0.75,Z0-0.32);
  { const b=add(new THREE.BoxGeometry(2.8,1.7,0.5),M(0xf5f1ea),f.g,SX(XB1+2.4),4.2,Z0-0.6,false); plateAt(f.g,wallText(256,160,'#f5f1ea','#c1121f',[['FIRE',0.5,0.22,'center',0.22],['STATION',0.5,0.22,'center',0.46],['消防局',0.5,0.36,'center',0.76]]),2.6,1.55,XB1+2.4,4.2,Z0-0.86); }
  [[X0+0.3*WB,9.5,'hk'],[X0+0.3*WB+2.4,11.5,'cn']].forEach(([x,h,k])=>{ add(new THREE.CylinderGeometry(0.08,0.1,h,6),M(0xdfe3e6),f.g,SX(x),PAR+h/2,Z0+2.5,false);
    const fl=new THREE.Mesh(new THREE.PlaneGeometry(2.4,1.6),new THREE.MeshStandardMaterial({map:flagTex(k),side:THREE.DoubleSide,roughness:0.8})); fl.position.set(SX(x-1.25),PAR+h-0.85,Z0+2.5); f.g.add(fl); fl.rotation.y=Math.PI; });
  [0.2,0.5].forEach(t=>floodlight(f.g,X0+(X1-X0)*t,G+1.9,Z0-0.4));
  // 右邊圍牆同鐵閘
  { const q=f.rq(X1,Z0-3,X1+1,Z0+6); boxQ(q,0.3,3.2,cream,cream); addBldQ(q,3.2);
    const gt=canvasTex(128,64,(g,w,h)=>{ g.clearRect(0,0,w,h); g.fillStyle='#9aa1a8'; for(let x=2;x<w;x+=10) g.fillRect(x,0,3,h); g.fillRect(0,4,w,4); g.fillRect(0,h-8,w,4); },false);
    const gm=new THREE.Mesh(new THREE.PlaneGeometry(6,2.8),new THREE.MeshStandardMaterial({map:gt,transparent:true,side:THREE.DoubleSide})); gm.position.set(SX(X1+4),1.7,Z0+5.5); gm.rotation.y=Math.PI; f.g.add(gm); }
  return {f}; }

if(REGION==='tm'){   // ===== 屯門、元朗、天水圍地標 =====
{ const f=placeLM(...RP(-450,505),56,40,r=>r.name==='震寰路'); const D=buildDepot(f,'屯 門 救 護 站','TUEN MUN AMBULANCE DEPOT','NO. 1 TSUN WEN ROAD','tm'); const face=D.face;
  LMK.parkedAmb=[[f.L(10,7),face],[f.L(21,7),face]];
  LMK.parkedAmb.forEach(([p,a])=>markRect(p,a,2.6,6.6));
  LMK.depot={pos:D.pos,a:D.a};
  MAP.poi.depot=f.L(0,20);
  // 隔籬消防局
  const g=placeLM(...RP(-450,330),44,36,r=>r.name==='震寰路');
  const fm=texMat('fire',canvasTex(256,96,(g2,w,h)=>{ g2.fillStyle='#ffd9cf'; g2.fillRect(0,0,w,h); g2.fillStyle='#c1121f'; g2.fillRect(0,h-16,w,16); g2.fillStyle='#8fb8d8'; g2.fillRect(30,20,70,40); g2.fillRect(156,20,70,40); }));
  let c2=g.rq(-20,8,20,34); boxQ(c2,0.3,14,fm,M(0xc1121f),8,3); addBldQ(c2,14); c2=g.rq(12,22,20,32); boxQ(c2,14,30,fm,M(0xc1121f),8,3);
  for(let k=0;k<3;k++) add(new THREE.BoxGeometry(9,6.4,0.3),M(0xc1121f),g.g,-12+k*12,3.4,7.85,false);
  labelPlane('消防局',0,10.5,7.7,Math.PI,'#c1121f',14,g.g);
}
// 屯門站（杯渡路北面，河西）
{ const f=placeLM(...RP(-80,560),40,24,r=>r.name==='杯渡路');
  const sm=texMat('stn',canvasTex(256,96,(g,w,h)=>{ g.fillStyle='#cfe6f7'; g.fillRect(0,0,w,h); g.fillStyle='#2f8fd8'; g.fillRect(0,h-20,w,20); g.fillStyle='#9cc9e6'; g.fillRect(10,14,236,46); }));
  const c=f.rq(-19,3,19,22); boxQ(c,0.3,16,sm,M(0x2f8fd8),16,6); addBldQ(c,16,'station');
  boxQ(f.rq(-21,6,21,19),16,17.2,roofMat,M(0x2f8fd8));
  labelPlane('屯門站',0,11,2.9,Math.PI,'#2f8fd8',14,f.g);
  LMK.station={patient:f.L(-9,-2.2),stop:curbStop(f,-13)}; }
// 屯門市廣場（屯喜路同青山公路之間）
{ const f=placeLM(...RP(330,760),64,48,r=>r.name==='屯喜路');
  const gm=texMat('plz',canvasTex(256,128,(g,w,h)=>{ g.fillStyle='#ffd6a5'; g.fillRect(0,0,w,h); g.fillStyle='#8ecae6'; g.fillRect(0,20,w,64); g.fillStyle='rgba(255,255,255,.45)'; for(let k=0;k<8;k++) g.fillRect(k*32,20,3,64); }));
  let c=f.rq(-30,6,30,46); boxQ(c,0.3,14,gm,M(0xffb366),24,7); addBldQ(c,14,'plaza');
  boxQ(f.rq(-26,12,4,40),14,24,gm,roofMat,24,7); boxQ(f.rq(10,14,26,30),14,44,pick(housingMats),roofMat,8,3);
  labelPlane('屯門市廣場',-12,10.5,5.9,Math.PI,'#f08c2e',24,f.g);
  for(let k=0;k<5;k++) add(new THREE.BoxGeometry(2,5,0.2),M([0xff6b6b,0x4ecdc4,0xffe66d,0x5f27cd][k%4]),f.g,6+k*5,9,5.6,false);
  LMK.plaza={patient:f.L(-12,-2.2),stop:curbStop(f,-4)}; MAP.poi.plaza=f.L(0,24); }
// 屯門大會堂（鄉事會路同屯喜路之間）
{ const f=placeLM(...RP(120,930),48,40,r=>r.name==='屯盛街');
  const tm=texMat('th',canvasTex(256,128,(g,w,h)=>{ g.fillStyle='#fff3c4'; g.fillRect(0,0,w,h); g.fillStyle='#d9a400'; for(let k=0;k<6;k++) g.fillRect(k*44+12,10,10,h-20); }));
  const c=f.rq(-22,12,22,38); boxQ(c,0.3,12,tm,M(0xe9c46a),20,8); addBldQ(c,12,'townhall');
  add(new THREE.CylinderGeometry(12,15,6,6),M(0xe9c46a),f.g,0,15,25,true);
  add(new THREE.CylinderGeometry(4,4.4,0.8,24),M(0xb8c4cf),f.g,14,0.7,5,false); add(new THREE.CylinderGeometry(3.4,3.4,0.2,24),M(0x7ec8f0,{e:0x113344}),f.g,14,1.15,5,false); markSeg(f.L(14,5),f.L(14,5),9,2);
  labelPlane('屯門大會堂',-4,9,11.9,Math.PI,'#d9a400',20,f.g);
  LMK.townhall={patient:f.L(-6,-2.2),stop:curbStop(f,2)}; MAP.poi.townhall=f.L(0,24); }
// 屯門公園（鄉事會路西面，有湖）
{ const f=placeLM(...RP(-60,880),56,30,r=>r.t==='avenue');
  boxQ(f.rq(-28,0,28,30),0,0.34,grassMat,grassMat);
  const pav=new THREE.Group(); pav.position.set(14,0.3,16); f.g.add(pav);
  [[-3,-3],[3,-3],[-3,3],[3,3]].forEach(([a,b])=>add(new THREE.CylinderGeometry(0.3,0.3,4,8),M(0xc1121f),pav,a,2,b));
  add(new THREE.ConeGeometry(6,3,4),M(0x2a9d8f),pav,0,5.4,0).rotation.y=Math.PI/4; markSeg(f.L(14,16),f.L(14,16),9,2);
  add(new THREE.BoxGeometry(6,0.3,2),M(0xffd166),f.g,-14,1.6,14,true); add(new THREE.BoxGeometry(0.4,3,0.4),M(0xff6b6b),f.g,-17,1.5,14,true);
  labelPlane('屯門公園',0,4,0.6,Math.PI,'#46a35e',14,f.g);
  LMK.park={patient:f.L(-4,-2.2),stop:curbStop(f,-10)}; MAP.poi.park=f.L(0,15);
  // 湖邊草地
  const L=LAKE; let cx=0,cz=0; L.forEach(([x,z])=>{cx+=x;cz+=z;}); cx/=L.length; cz/=L.length; const gr=[]; disc(gr,[cx,cz],34,24); flat(gr,M(0x9fd77c,{r:0.95}),0.05);
  for(let k=0;k<24;k++){ const a=rnd()*6.28, r=24+rnd()*12; const x=cx+Math.cos(a)*r, z=cz+Math.sin(a)*r; if(!(cellAt(x,z)&(1|4|16))){ props.tree.push([x,z,0,0.05]); } }
  for(let z=cz-36;z<=cz+36;z+=CELL) for(let x=cx-36;x<=cx+36;x+=CELL) if(Math.hypot(x-cx,z-cz)<34){ const k=gi(x,z); if(k>=0&&!(grid[k]&(1|16))) grid[k]|=8; }
  MAP.parks.push(f.rq(-28,0,28,30)); }
// 屯門街市（新墟）同學校
{ const f=placeLM(...RP(200,-180),40,28,r=>r.name==='新墟路');
  const c=f.rq(-20,2,20,26); boxQ(c,0.3,10,texMat('mk',shopTex()),M(0x6ab04c),24,4.5); addBldQ(c,10);
  labelPlane('屯門街市',0,8,1.9,Math.PI,'#2b9348',16,f.g);
  LMK.market={patient:f.L(-9,-2.2),stop:curbStop(f,-13)}; }
[[-330,-330,'震寰路'],[150,1000,'屯興路']].forEach(([x,z,nm])=>{ const f=placeLM(...RP(x,z),50,36,r=>r.name===nm);
  boxQ(f.rq(-23,4,4,32),0,0.4,M(0xe9824c),M(0xe9824c));
  const c=f.rq(8,4,24,34); boxQ(c,0.3,16,texMat('sch',housingTex('#dff3c8','#2a9d8f',1)),M(0x2a9d8f),8,3); addBldQ(c,16);
  labelPlane('小學',16,12,3.8,Math.PI,'#2a9d8f',10,f.g); });

/* ---------- 元朗區（簡化）：救護站、博愛醫院（上面）、YOHO Mall＋元朗站、元朗公園、元朗劇院 ---------- */
{ const f=placeLM(...RP(1440,-1590),56,40,r=>r.name==='擊壤路'); const D=buildDepot(f,'元 朗 救 護 站','YUEN LONG AMBULANCE DEPOT','YUEN LONG','yl');
  LMK.depotYL={pos:D.pos,a:D.a}; MAP.poi.depotYL=f.L(0,20); }
// YOHO Mall（形點）：玻璃幕牆商場＋上面住宅
{ const f=placeLM(...RP(1520,-2000),60,44,r=>r.name==='朗日路');
  const gm=texMat('yoho',canvasTex(256,128,(g,w,h)=>{ g.fillStyle='#e9eef2'; g.fillRect(0,0,w,h); g.fillStyle='#7fb7d9'; g.fillRect(0,14,w,80); g.fillStyle='rgba(255,255,255,.5)'; for(let k=0;k<10;k++) g.fillRect(k*26,14,3,80); g.fillStyle='#e4572e'; g.fillRect(0,100,w,10); }));
  let c=f.rq(-29,6,29,42); boxQ(c,0.3,15,gm,M(0xd9dee3),24,7); addBldQ(c,15,'plaza');
  [[-20,14],[2,14]].forEach(([x,z])=>{ const q=f.rq(x,z+6,x+16,z+22); boxQ(q,15,58,pick(housingMats),roofMat,8,3); });
  labelPlane('YOHO MALL 形點',-6,10.5,5.9,Math.PI,'#e4572e',26,f.g);
  LMK.yoho={patient:f.L(-12,-2.2),stop:curbStop(f,-4)}; MAP.poi.yoho=f.L(0,24); }
// 元朗站（屯馬綫）
{ const f=placeLM(...RP(1300,-2000),40,26,r=>r.name==='朗日路');
  const sm=texMat('ylstn',canvasTex(256,96,(g,w,h)=>{ g.fillStyle='#efe3dc'; g.fillRect(0,0,w,h); g.fillStyle='#9a3b26'; g.fillRect(0,h-20,w,20); g.fillStyle='#b9c9d6'; g.fillRect(10,14,236,46); }));
  const c=f.rq(-19,3,19,24); boxQ(c,0.3,13,sm,M(0x9a3b26),16,6); addBldQ(c,13,'station');
  boxQ(f.rq(-21,5,21,22),13,14.4,roofMat,M(0x9a3b26));
  labelPlane('元朗站',0,9.5,2.9,Math.PI,'#9a3b26',14,f.g);
  LMK.ylstation={patient:f.L(-9,-2.2),stop:curbStop(f,-13)}; }
// 元朗公園（寶塔）
{ const f=placeLM(...RP(1540,-1400),60,40,r=>r.name==='體育路');
  boxQ(f.rq(-30,0,30,40),0,0.34,grassMat,grassMat);
  const pg=new THREE.Group(); pg.position.set(12,0.3,24); f.g.add(pg);   // 七層寶塔
  for(let i=0;i<7;i++){ const r=4.2-i*0.45, y=i*3.0; add(new THREE.CylinderGeometry(r*0.78,r*0.82,2.4,8),M(0xf3e7c9),pg,0,y+1.2,0); add(new THREE.CylinderGeometry(r*0.55,r*1.12,0.8,8),M(0x2f7d5b),pg,0,y+2.7,0); }
  add(new THREE.ConeGeometry(0.9,2.4,8),M(0xd4a017),pg,0,22.6,0); markSeg(f.L(12,24),f.L(12,24),11,2);
  for(let k=0;k<10;k++){ const x=-26+(k%5)*7, z=10+(k>4?14:0); props.tree.push([...f.L(x,z),0,0.05]); }
  add(new THREE.BoxGeometry(6,0.3,2),M(0xffd166),f.g,-12,1.6,6,true);
  labelPlane('元朗公園',-6,4,0.6,Math.PI,'#46a35e',14,f.g);
  LMK.ylpark={patient:f.L(-6,-2.2),stop:curbStop(f,-10)}; MAP.poi.ylpark=f.L(0,18); MAP.parks.push(f.rq(-30,0,30,40)); }
// 元朗劇院（紅磚外牆、大斜頂）
{ const f=placeLM(...RP(1830,-1400),48,38,r=>r.name==='體育路');
  const tm=texMat('ylth',canvasTex(256,128,(g,w,h)=>{ g.fillStyle='#b5523b'; g.fillRect(0,0,w,h); g.fillStyle='rgba(0,0,0,.12)'; for(let y=0;y<h;y+=8) g.fillRect(0,y,w,2); g.fillStyle='#f1e3c8'; g.fillRect(0,h-26,w,26); g.fillStyle='#3c4656'; g.fillRect(90,h-56,76,30); }));
  const c=f.rq(-22,8,22,34); boxQ(c,0.3,14,tm,M(0x8f3d2c),20,8); addBldQ(c,14,'townhall');
  const rf=add(new THREE.CylinderGeometry(0.1,17,8,4),M(0x8f3d2c),f.g,0,18,21,true); rf.rotation.y=Math.PI/4; rf.scale.set(1.3,1,0.75);
  add(new THREE.BoxGeometry(20,0.5,6),M(0xf1e3c8),f.g,0,6,6,true); [-9,9].forEach(x=>add(new THREE.CylinderGeometry(0.4,0.4,5.6,8),M(0xf1e3c8),f.g,x,3,4,true));
  // 搭棚（劇院翻新）：竹棚＋綠色防護網，創傷分流關嘅出事地點
  const sc=new THREE.Group(); sc.position.set(-16,0.3,8); f.g.add(sc); for(let i=0;i<4;i++) for(let j=0;j<5;j++){ add(new THREE.BoxGeometry(0.15,0.15,10),M(0xc8a165),sc,0,j*3+0.5,-3+i*0.05,false).rotation.y=Math.PI/2; }
  for(let i=0;i<5;i++) add(new THREE.CylinderGeometry(0.08,0.08,14,5),M(0xc8a165),sc,-4+i*2,7,-3,false);
  const net=new THREE.Mesh(new THREE.PlaneGeometry(10,13),new THREE.MeshStandardMaterial({color:0x2e8b57,transparent:true,opacity:0.55,side:THREE.DoubleSide})); net.position.set(0,7,-3.3); sc.add(net);
  labelPlane('元朗劇院',2,9,2.8,Math.PI,'#8f3d2c',16,f.g);
  LMK.yltheatre={patient:f.L(-12,-2.2),stop:curbStop(f,-8)}; MAP.poi.yltheatre=f.L(0,24); }

/* ---------- 天水圍區（簡化）：天水圍醫院、救護站、濕地公園、天水圍公園、天水圍站、嘉湖山莊、屏山聚星樓 ---------- */
LMK.ae3=buildHosp('TH','天水圍醫院',['#eef3f8','#3a6ea5'],['#e6f4f1','#2a9d8f']); MAP.poi.hospital3=LMK.ae3.poi;
{ const f=placeLM(...RP(960,-2270),56,40,r=>r.name==='天華路'); const D=buildDepot(f,'天 水 圍 救 護 站','TIN SHUI WAI AMBULANCE DEPOT','TIN SHUI WAI','tsw');
  LMK.depotTSW={pos:D.pos,a:D.a}; MAP.poi.depotTSW=f.L(0,20); }
// 天水圍站（屯馬綫）：月台架空、灰白外牆、啡紅色線條
{ const f=placeLM(...RP(560,-2215),44,28,r=>r.name==='天瑞路');
  const sm=texMat('tswstn',canvasTex(256,96,(g,w,h)=>{ g.fillStyle='#e8e4dc'; g.fillRect(0,0,w,h); g.fillStyle='#9a3b26'; g.fillRect(0,h-18,w,18); g.fillStyle='#a9bfd0'; for(let k=0;k<6;k++) g.fillRect(8+k*41,16,33,44); }));
  const c=f.rq(-21,3,21,25); boxQ(c,0.3,14,sm,M(0x9a3b26),16,6); addBldQ(c,14,'station');
  boxQ(f.rq(-23,5,23,23),14,15.2,roofMat,M(0x7d8590));
  labelPlane('天水圍站',0,10,2.9,Math.PI,'#9a3b26',15,f.g);
  LMK.tswstation={patient:f.L(-10,-2.2),stop:curbStop(f,-14)}; MAP.poi.tswstation=f.L(0,14); }
// 嘉湖山莊：一排排 40 幾層高嘅住宅大廈（同一批材質，合併成少量幾何）
{ const f=placeLM(...RP(500,-2500),64,56,r=>r.name==='天城路');
  boxQ(f.rq(-32,0,32,56),0,0.32,podMat,podMat);
  [[-28,6],[-6,6],[16,6],[-28,32],[-6,32],[16,32]].forEach(([x,z],i)=>{ const q=f.rq(x,z,x+14,z+16), h=88+(i%3)*8; boxQ(q,0.3,h,housingMats[(i+2)%housingMats.length],roofMat,8,3); addBldQ(q,h); });
  labelPlane('嘉湖山莊',0,5,0.4,Math.PI,'#5aa9e6',16,f.g); }
// 天水圍公園：大草地、湖、行人路、涼亭
{ const f=placeLM(...RP(790,-2330),64,44,r=>r.name==='天湖路');
  boxQ(f.rq(-32,0,32,44),0,0.34,grassMat,grassMat);
  const lake=add(new THREE.CylinderGeometry(9,9,0.1,20),M(0x5aa7c8,{r:0.4}),f.g,10,0.4,24,false); lake.scale.set(1.4,1,0.9); markSeg(f.L(10,24),f.L(10,24),24,2);
  const pav=new THREE.Group(); pav.position.set(-16,0.34,26); f.g.add(pav);
  [[-2,-2],[2,-2],[2,2],[-2,2]].forEach(([x,z])=>add(new THREE.CylinderGeometry(0.2,0.2,3,6),M(0xb5523b),pav,x,1.5,z,false));
  add(new THREE.ConeGeometry(4,1.8,4),M(0x2f7d5b),pav,0,3.9,0,true).rotation.y=Math.PI/4; markSeg(f.L(-16,26),f.L(-16,26),6,2);
  for(let k=0;k<12;k++){ const x=-28+(k%6)*11, z=k>5?38:8; props.tree.push([...f.L(x,z),0,0.05]); }
  labelPlane('天水圍公園',-6,4,0.6,Math.PI,'#46a35e',15,f.g);
  LMK.tswpark={patient:f.L(-6,-2.2),stop:curbStop(f,-10)}; MAP.poi.tswpark=f.L(0,20); MAP.parks.push(f.rq(-32,0,32,44)); }
// 香港濕地公園：訪客中心（草地斜頂）、濕地水塘、木棧道、觀鳥屋
{ const f=placeLM(...RP(650,-2700),84,50,r=>r.name==='天恩路');
  boxQ(f.rq(-42,0,42,50),0,0.3,M(0x8fbf6a,{r:0.95}),M(0x8fbf6a,{r:0.95}));
  const vc=f.rq(-38,4,-6,22); boxQ(vc,0.3,7,texMat('wlvc',canvasTex(256,96,(g,w,h)=>{ g.fillStyle='#d8cdb8'; g.fillRect(0,0,w,h); g.fillStyle='#7fa9c4'; g.fillRect(0,22,w,48); g.fillStyle='rgba(255,255,255,.4)'; for(let k=0;k<12;k++) g.fillRect(k*22,22,3,48); })),M(0x6aa84f),16,7); addBldQ(vc,7,'plaza');
  const rf=add(new THREE.BoxGeometry(34,0.6,20),M(0x6aa84f),f.g,-22,8.2,13,true); rf.rotation.x=-0.12;
  const pond=add(new THREE.CylinderGeometry(14,14,0.1,24),M(0x4f9fc2,{r:0.35}),f.g,18,0.4,28,false); pond.scale.set(1.5,1,1); markSeg(f.L(18,28),f.L(18,28),40,2);
  for(let k=0;k<6;k++) add(new THREE.BoxGeometry(2.2,0.25,5.2),M(0xa0764a),f.g,4+k*5,0.6,16+k*2.2,false).rotation.y=0.4;   // 木棧道
  const bh=new THREE.Group(); bh.position.set(34,0.3,38); f.g.add(bh); add(new THREE.BoxGeometry(6,3,4),M(0x8a6a48),bh,0,1.8,0,true); add(new THREE.ConeGeometry(4.6,1.6,4),M(0x5b4632),bh,0,4.1,0,true).rotation.y=Math.PI/4; markSeg(f.L(34,38),f.L(34,38),7,2);
  for(let k=0;k<14;k++){ const a=k/14*6.28; props.tree.push([...f.L(18+Math.cos(a)*24,28+Math.sin(a)*15),0,0.05]); }
  labelPlane('香港濕地公園',-22,4.4,3.6,Math.PI,'#3f8f5a',20,f.g);
  LMK.tswwet={patient:f.L(-10,-2.2),stop:curbStop(f,-14)}; MAP.poi.tswwet=f.L(0,24); MAP.parks.push(f.rq(-42,0,42,50)); }
// 屏山聚星樓：六角形三層青磚塔
{ const f=placeLM(...RP(1110,-2030),40,30,r=>r.name==='屏廈路');
  boxQ(f.rq(-20,0,20,30),0,0.32,M(0xc9bfa8,{r:0.95}),M(0xc9bfa8,{r:0.95}));
  const pg=new THREE.Group(); pg.position.set(6,0.3,17); f.g.add(pg);
  add(new THREE.CylinderGeometry(4.6,4.8,1,6),M(0x9a9486),pg,0,0.5,0,true);
  [[4.2,5.2],[3.6,4.4],[3.0,3.8]].forEach(([r,h],i)=>{ const y=1+[0,5.2,9.6][i]; add(new THREE.CylinderGeometry(r*0.92,r,h,6),M(0x8f8a7c),pg,0,y+h/2,0,true); add(new THREE.CylinderGeometry(r*0.7,r*1.12,0.5,6),M(0x6e6a60),pg,0,y+h-0.1,0,false); });
  add(new THREE.ConeGeometry(1.2,2,6),M(0x6e6a60),pg,0,14.9,0,false); markSeg(f.L(6,17),f.L(6,17),11,2);
  for(let k=0;k<5;k++) props.tree.push([...f.L(-16+k*3,24),0,0.05]);
  labelPlane('聚星樓',-8,4,0.6,Math.PI,'#6e6a60',12,f.g);
  LMK.jusing={patient:f.L(-6,-2.2),stop:curbStop(f,-10)}; MAP.poi.jusing=f.L(0,16); }

}   // ===== 屯門地標完 =====
if(REGION==='st'){   // ===== 沙田區：以源禾路（沙田消防局暨救護站）為中心，其他道路簡化；威爾斯親王醫院、沙田／田心救護站、新城市廣場、沙田站、沙田公園、馬場、車公廟、文化博物館、曾大屋、第一城、萬佛寺、望夫石 =====
LMK.ae=buildHosp('PWH','威爾斯親王醫院',['#eef1f6','#1f5fa8'],['#e8f0fb','#1f5fa8']); MAP.poi.hospital=LMK.ae.poi;
// 沙田消防局暨救護站（源禾路26號，城門河邊、划艇中心隔籬）
{ const f=placeLM(...RP(890,-700),56,40,r=>r.name==='源禾路'); const D=buildDepotST(f,1,5);   // 沙田救護車站：真實外觀（單層開放式車房）
  LMK.parkedAmb=D.parked; LMK.parkedAmb.forEach(([p,a])=>markRect(p,a,2.6,6.6)); LMK.depot={pos:D.pos,a:D.a}; MAP.poi.depot=f.L(0,20);
  const g=placeBeside(f,28,60,30,-1)||placeLM(...RP(940,-755),60,30,r=>r.name==='源禾路'); buildFireST(g,1,5); LMK._fireF=g; }   // 沙田區消防總局：喺救護站隔籬
{ const f=placeLM(...RP(-850,560),56,40,r=>r.name==='富健街'); const D=buildDepotTS(f,1); LMK.depotTS={pos:D.pos,a:D.a}; MAP.poi.depotTS=f.L(0,20); }
// 沙田划艇中心：船屋、草地上一排獨木舟
{ const f=(LMK._fireF&&placeBeside(LMK._fireF,30,40,30,1))||placeLM(...RP(1050,-900),40,30,r=>r.name==='源禾路');
  const c=f.rq(-18,4,4,18); boxQ(c,0.3,7,texMat('rowc',canvasTex(128,64,(g,w,h)=>{ g.fillStyle='#eef3f6'; g.fillRect(0,0,w,h); g.fillStyle='#2a7ab8'; g.fillRect(0,h-10,w,10); g.fillStyle='#8fb8d8'; for(let x=8;x<w;x+=30) g.fillRect(x,14,20,24); })),M(0x2a7ab8),10,3); addBldQ(c,7);
  ['#e94e1b','#ffd166','#2a9d8f','#e94e1b','#3a86ff'].forEach((col,k)=>{ const b=add(new THREE.BoxGeometry(1.2,0.6,7),M(new THREE.Color(col).getHex()),f.g,8+k*2.4,0.7,18,false); });
  labelPlane('沙田划艇中心',0,4,0.5,Math.PI,'#2a7ab8',14,f.g); }
// 香港體育學院（源禾路25號）
{ const f=placeLM(...RP(1060,-1170),60,44,r=>r.name==='源禾路');
  boxQ(f.rq(-30,0,30,44),0,0.32,grassMat,grassMat);
  const c=f.rq(-28,4,6,24); boxQ(c,0.3,12,texMat('hksi',canvasTex(256,96,(g,w,h)=>{ g.fillStyle='#f2f4f7'; g.fillRect(0,0,w,h); g.fillStyle='#d62839'; g.fillRect(0,0,w,10); g.fillStyle='#93b0c4'; for(let r=0;r<3;r++) g.fillRect(6,22+r*22,w-12,12); })),M(0xd62839),12,3); addBldQ(c,12);
  const trk=add(new THREE.RingGeometry(8,11,28),M(0xc0503a,{r:0.95}),f.g,18,0.36,26,false); trk.rotation.x=-Math.PI/2; trk.scale.set(1.3,1,1);
  labelPlane('香港體育學院',0,4,0.5,Math.PI,'#d62839',16,f.g); MAP.parks.push(f.rq(8,10,30,42)); }
// 沙田運動場（源禾路18號）：400 米跑道、看台
{ const f=placeLM(...RP(600,-150),70,56,r=>r.name==='源禾路');
  boxQ(f.rq(-35,0,35,56),0,0.32,grassMat,grassMat);
  const trk=add(new THREE.RingGeometry(14,19,40),M(0xc0503a,{r:0.95}),f.g,0,0.36,30,false); trk.rotation.x=-Math.PI/2; trk.scale.set(1.6,1,1);
  const fd=add(new THREE.PlaneGeometry(36,22),M(0x5fae4a,{r:0.95}),f.g,0,0.37,30,false); fd.rotation.x=-Math.PI/2;
  const st=f.rq(-24,2,24,7); boxQ(st,0.3,9,M(0xdfe3e6),M(0x2a7ab8),12,3); addBldQ(st,9);
  labelPlane('沙田運動場',0,9.6,1.6,Math.PI,'#2a7ab8',16,f.g); MAP.parks.push(f.rq(-35,8,35,56)); LMK.stsport={patient:f.L(-14,-2.2),stop:curbStop(f,-18)}; MAP.poi.stsport=f.L(0,30); }
// 沙田賽馬會游泳池
{ const f=placeLM(...RP(300,-250),40,30,r=>r.name==='沙田鄉事會路');
  const c=f.rq(-18,2,0,26); boxQ(c,0.3,8,M(0xe6eef2),M(0x2a7ab8),10,3); addBldQ(c,8);
  const pl=add(new THREE.BoxGeometry(14,0.1,20),M(0x4fc3f7,{r:0.3}),f.g,10,0.4,15,false);
  labelPlane('沙田賽馬會游泳池',0,4,0.5,Math.PI,'#2a7ab8',14,f.g); }
// 禾輋廣場
{ const f=placeLM(...RP(400,-380),44,32,r=>r.name==='禾輋街');
  const c=f.rq(-21,2,21,30); boxQ(c,0.3,10,pick(shopMats),podMat,24,4.5); addBldQ(c,10,'plaza'); const t=f.rq(-10,10,10,26); boxQ(t,10,48,housingMats[2],roofMat,8,3);
  labelPlane('禾輋廣場',0,6,2.1,Math.PI,'#e07a1f',14,f.g); LMK.stwoche={patient:f.L(-10,-2.2),stop:curbStop(f,-14)}; MAP.poi.stwoche=f.L(0,16); }
// 沙田大會堂
{ const f=placeLM(...RP(250,240),44,30,r=>r.name==='担杆莆街');
  const c=f.rq(-20,4,20,28); boxQ(c,0.3,13,texMat('sttownh',canvasTex(256,96,(g,w,h)=>{ g.fillStyle='#e9e3d6'; g.fillRect(0,0,w,h); g.fillStyle='#8a6e4b'; for(let x=10;x<w;x+=26) g.fillRect(x,8,8,h-16); })),M(0x8a6e4b),10,3); addBldQ(c,13);
  labelPlane('沙田大會堂',0,4,0.6,Math.PI,'#8a6e4b',14,f.g); LMK.sttownh={patient:f.L(-10,-2.2),stop:curbStop(f,-14)}; MAP.poi.sttownh=f.L(0,16); }
// 新城市廣場：大型商場，玻璃幕牆、上面有寫字樓
{ const f=placeLM(...RP(230,70),58,42,r=>r.name==='橫壆街');
  const gm=texMat('ntp',canvasTex(256,128,(g,w,h)=>{ g.fillStyle='#cfd8e3'; g.fillRect(0,0,w,h); g.fillStyle='#7fa7c9'; for(let x=6;x<w;x+=22) g.fillRect(x,10,16,h-20); g.fillStyle='#e94e1b'; g.fillRect(0,0,w,8); }));
  const c=f.rq(-28,2,28,40); boxQ(c,0.3,16,gm,roofMat,12,3); addBldQ(c,16,'plaza'); const t=f.rq(-12,12,14,36); boxQ(t,16,62,housingMats[1],roofMat,8,3);
  labelPlane('新城市廣場',0,12,1.8,Math.PI,'#e94e1b',26,f.g); LMK.stntp={patient:f.L(-12,-2.2),stop:curbStop(f,-16)}; MAP.poi.stntp=f.L(0,24); }
// 沙田站（東鐵綫）
{ const f=placeLM(...RP(-110,70),44,26,r=>r.name==='沙田正街');
  const sm=texMat('ststn',canvasTex(256,96,(g,w,h)=>{ g.fillStyle='#e8eef3'; g.fillRect(0,0,w,h); g.fillStyle='#5eb7e8'; g.fillRect(0,h-18,w,18); g.fillStyle='#a9bfd0'; for(let k=0;k<6;k++) g.fillRect(8+k*41,16,33,44); }));
  const c=f.rq(-21,3,21,24); boxQ(c,0.3,12,sm,roofMat,16,6); addBldQ(c,12,'station'); labelPlane('沙田站',0,9,2.9,Math.PI,'#3a8fc4',14,f.g); LMK.ststn={patient:f.L(-10,-2.2),stop:curbStop(f,-14)}; MAP.poi.ststn=f.L(0,14); }
// 沙田公園：城門河邊大草地、湖、單車徑
{ const f=placeLM(...RP(470,40),64,40,r=>r.name==='源禾路');
  boxQ(f.rq(-32,0,32,40),0,0.32,grassMat,grassMat); const ln=add(new THREE.BoxGeometry(60,0.05,3),M(0xb5523b,{r:0.9}),f.g,0,0.36,34,false);   // 單車徑
  for(let k=0;k<14;k++) props.tree.push([...f.L(-30+(k%7)*10,k>6?26:10),0,0.05]);
  labelPlane('沙田公園',0,4,0.6,Math.PI,'#46a35e',14,f.g); LMK.stpark={patient:f.L(6,30),stop:curbStop(f,-4)}; MAP.poi.stpark=f.L(0,20); MAP.parks.push(f.rq(-32,0,32,40)); }
// 沙田馬場：橢圓跑道、看台
{ const f=placeLM(...RP(1300,-1120),130,70,r=>r.name==='源禾路');
  boxQ(f.rq(-65,0,65,70),0,0.3,M(0x7cc25a,{r:0.95}),M(0x7cc25a,{r:0.95}));
  const trk=add(new THREE.RingGeometry(20,27,40),M(0xc9a26b,{r:0.95}),f.g,0,0.34,40,false); trk.rotation.x=-Math.PI/2; trk.scale.set(2.2,1,1);
  const st=f.rq(-40,3,40,13); boxQ(st,0.3,18,texMat('grand',canvasTex(256,96,(g,w,h)=>{ g.fillStyle='#e9ece6'; g.fillRect(0,0,w,h); g.fillStyle='#2f6b4f'; g.fillRect(0,0,w,14); g.fillStyle='#93b0c4'; for(let r=0;r<3;r++) g.fillRect(4,24+r*22,w-8,12); })),M(0x2f6b4f),18,4); addBldQ(st,18);
  labelPlane('沙田馬場',0,21,2.4,Math.PI,'#2f6b4f',20,f.g); LMK.strace={patient:f.L(-20,-2.2),stop:curbStop(f,-24)}; MAP.poi.strace=f.L(0,40); MAP.parks.push(f.rq(-65,14,65,70)); }
// 車公廟：紅柱黃瓦
{ const f=placeLM(...RP(0,1300),44,34,r=>r.name==='車公廟路');
  boxQ(f.rq(-22,0,22,34),0,0.3,M(0xd9c7a3,{r:0.95}),M(0xd9c7a3,{r:0.95}));
  const t=new THREE.Group(); t.position.copy(new THREE.Vector3(0,0.3,20)); f.g.add(t);
  add(new THREE.BoxGeometry(18,6,10),M(0xb22a1e),t,0,3,0,true); const rf=add(new THREE.ConeGeometry(13,4,4),M(0xe2b13c),t,0,8,0,true); rf.rotation.y=Math.PI/4; rf.scale.set(1,1,0.62);
  add(new THREE.BoxGeometry(4,4.5,1),M(0x6b1d14),t,0,2.3,5.05,false); markSeg(f.L(0,20),f.L(0,20),20,2);
  labelPlane('車公廟',0,4,0.6,Math.PI,'#b22a1e',12,f.g); LMK.stck={patient:f.L(-6,-2.2),stop:curbStop(f,-10)}; MAP.poi.stck=f.L(0,18); }
// 香港文化博物館
{ const f=placeLM(...RP(-50,1060),56,36,r=>r.name==='大涌橋路');
  const c=f.rq(-26,4,26,32); boxQ(c,0.3,10,texMat('hkhm',canvasTex(256,96,(g,w,h)=>{ g.fillStyle='#d8d2c6'; g.fillRect(0,0,w,h); g.fillStyle='#8a7d6b'; for(let x=10;x<w;x+=40) g.fillRect(x,30,24,40); })),M(0x6d6a63),10,3); addBldQ(c,10);
  const rf=add(new THREE.ConeGeometry(30,5,4),M(0x5f6b73),f.g,0,12.5,18,true); rf.rotation.y=Math.PI/4; rf.scale.set(1,1,0.55);
  labelPlane('香港文化博物館',0,4,0.6,Math.PI,'#6d6a63',18,f.g); }
// 曾大屋：青磚圍屋、四角碉樓
{ const f=placeLM(...RP(520,900),48,44,r=>r.name==='沙角街');
  const wm=M(0x8e96a0,{r:0.9}); const o=[-22,4,22,42]; [[o[0],o[1],o[2],o[1]+2],[o[0],o[3]-2,o[2],o[3]],[o[0],o[1],o[0]+2,o[3]],[o[2]-2,o[1],o[2],o[3]]].forEach(([a,b,c,d])=>{ const q=f.rq(a,b,c,d); boxQ(q,0.3,7,wm,M(0x5f666e),6,3); addBldQ(q,7); });
  [[o[0],o[1]],[o[2]-5,o[1]],[o[0],o[3]-5],[o[2]-5,o[3]-5]].forEach(([a,b])=>{ const q=f.rq(a,b,a+5,b+5); boxQ(q,0.3,11,wm,M(0x4c535a),3,4); });
  boxQ(f.rq(-4,3.9,4,4.2),0.3,4.5,M(0x3a2a20),M(0x3a2a20));
  labelPlane('曾大屋',0,9,3.6,Math.PI,'#5f666e',12,f.g); LMK.sttsang={patient:f.L(-8,-2.2),stop:curbStop(f,-12)}; MAP.poi.sttsang=f.L(0,22); }
// 沙田第一城：一排排住宅
{ const f=placeLM(...RP(1550,-760),64,50,r=>r.name==='沙田路');
  boxQ(f.rq(-32,0,32,50),0,0.32,podMat,podMat);
  [[-28,6],[-6,6],[16,6],[-28,30],[-6,30],[16,30]].forEach(([x,z],i)=>{ const q=f.rq(x,z,x+13,z+14), h=70+(i%2)*8; boxQ(q,0.3,h,housingMats[(i+4)%housingMats.length],roofMat,8,3); addBldQ(q,h); });
  labelPlane('沙田第一城',0,5,0.4,Math.PI,'#5aa9e6',18,f.g); LMK.stcity={patient:f.L(-10,-2.2),stop:curbStop(f,-14)}; MAP.poi.stcity=f.L(0,24); }
// 萬佛寺：排頭街山腳入口牌坊，山頂紅色九層塔
{ const f=placeLM(...RP(-250,-330),40,24,r=>r.name==='排頭街');
  const gate=new THREE.Group(); gate.position.set(0,0.3,8); f.g.add(gate);
  [-6,6].forEach(x=>add(new THREE.BoxGeometry(1,7,1),M(0xb22a1e),gate,x,3.5,0,false)); add(new THREE.BoxGeometry(15,1.4,2),M(0xe2b13c),gate,0,7.5,0,false);
  labelPlane('萬佛寺',0,9.4,1.1,Math.PI,'#b22a1e',10,gate);
  const H=f.L(0,70), hm=M(0x5d8f4e,{r:0.95}); hillQ(H[0],H[1],46,40,40,0.4,hm); for(let zz=H[1]-46;zz<=H[1]+46;zz+=CELL) for(let xx=H[0]-46;xx<=H[0]+46;xx+=CELL) if(Math.hypot(xx-H[0],zz-H[1])<44){ const q=gi(xx,zz); if(q>=0) grid[q]|=2|8; }
  const pg=new THREE.Group(); pg.position.set(H[0],38,H[1]); scene.add(pg);
  for(let i=0;i<9;i++){ const r=4-i*0.3, y=i*3; add(new THREE.CylinderGeometry(r*0.9,r,2.6,8),M(0xc8382a),pg,0,y+1.3,0,i<2); add(new THREE.CylinderGeometry(r*0.6,r*1.18,0.6,8),M(0xe2b13c),pg,0,y+2.8,0,false); }
  add(new THREE.ConeGeometry(1,3,8),M(0xe2b13c),pg,0,28.5,0,false);
  LMK.stbuddha={patient:f.L(-6,-2.2),stop:curbStop(f,-10)}; MAP.poi.stbuddha=f.L(0,14); }
// 望夫石：南面山頂嘅石柱（遠景）
{ const P=RP(-520,1400), hm=M(0x6a9f58,{r:0.95}); hillQ(P[0],P[1],70,70,60,1.1,hm);
  const rk=new THREE.Group(); rk.position.set(P[0],66,P[1]); scene.add(rk); add(new THREE.CylinderGeometry(2.6,3.4,12,7),M(0x9a9184),rk,0,6,0,true); add(new THREE.SphereGeometry(2.8,8,6),M(0x9a9184),rk,0.6,13,0,true);
  for(let zz=P[1]-70;zz<=P[1]+70;zz+=CELL) for(let xx=P[0]-70;xx<=P[0]+70;xx+=CELL) if(Math.hypot(xx-P[0],zz-P[1])<66){ const q=gi(xx,zz); if(q>=0&&!(grid[q]&1)) grid[q]|=2|8; } }
}   // ===== 沙田地標完 =====

/* ---------- 一般樓宇：沿街＋內街 ---------- */
const zoneOf=(x,z)=>x>20&&z<60?'old':(x>-10&&z>140?'centre':'res');
const ZMIX={old:['tong','tong','tong','shops','tong','estate'],centre:['tong','shops','estate','tong','shops','estate'],res:['estate','estate','tong','shops','estate','tong']};
function buildTong(c,front,nx,nz){ const h=13+rnd()*13; boxQ(c,0.3,4.8,pick(shopMats),roofMat,24,4.5,rnd()*4|0);
  const ci=c.map(([x,z])=>{ const cx=(c[0][0]+c[2][0])/2, cz=(c[0][1]+c[2][1])/2; return [x+(cx-x)*0.04,z+(cz-z)*0.04]; });
  boxQ(ci,4.8,h,pick(tongMats),roofMat,8.5,3); addBldQ(c,h);
  if(rnd()<0.7) signs.push({x:front[0]-nx*1.3,z:front[1]-nz*1.3,y:6.5+rnd()*5,a:Math.atan2(-nx,-nz)}); }
function buildShops(c){ boxQ(c,0.3,4.8,pick(shopMats),roofMat,24,4.5); boxQ(c,4.8,10,pick(tongMats),roofMat,8.5,3); addBldQ(c,10); }
function buildEstate(L,w,d){ const pod=4.8; let c=[L(0,0),L(w,0),L(w,d),L(0,d)]; boxQ(c,0.3,pod,pick(shopMats),podMat,24,4.5); addBldQ(c,pod);
  const hm=pick(housingMats); let top=pod; const n=w>30?2:1;
  for(let k=0;k<n;k++){ const tw=14, td=Math.min(14,d-6); const cx=n===1?w/2:(k?w-tw/2-3:tw/2+3); const h=pod+18+rnd()*16; top=Math.max(top,h);
    boxQ([L(cx-tw/2,d/2-td/2),L(cx+tw/2,d/2-td/2),L(cx+tw/2,d/2+td/2),L(cx-tw/2,d/2+td/2)],pod,h,hm,roofMat,8,3); }
  MAP.blds[MAP.blds.length-1].h=top; }
// 沿街
const J3=NODES.map((_,i)=>i).filter(i=>DEG[i]>=3);
MAP.roads.forEach(r=>{ if(r.bridge||r.elev) return; const [a,b]=r.n, A=NODES[a], B=NODES[b]; const [ux,uz,Lr]=dirn(A,B);
  [1,-1].forEach(side=>{ const nx=uz*side, nz=-ux*side; const off=r.w/2+5.2;
    let s=(DEG[a]>=3?NW[a]+5:DEG[a]===2?0.5:2); const s1=Lr-(DEG[b]>=3?NW[b]+5:DEG[b]===2?0.5:2);
    // 沿住路邊每隔一段放樹／街燈
    const LS=REGION==='sr'?17:11; for(let q=s+3;q<s1-2;q+=LS){ const P=d=>[A[0]+ux*d+nx*(r.w/2+1.4), A[1]+uz*d+nz*(r.w/2+1.4)];   // 街燈加密：每 11 米一支，樹擺喺兩支街燈中間
      const [x,z]=P(q); props.lamp.push([x,z,Math.atan2(-nx,-nz),0.1]); if((q/LS|0)%2&&q+LS/2<s1-2){ const [tx,tz]=P(q+LS/2); props.tree.push([tx,tz,Math.atan2(-nx,-nz),0.1]); } }
    while(REGION!=='sr'&&s<s1-6){ const x=A[0]+ux*s, z=A[1]+uz*s; const zn=zoneOf(x,z); let type=pick(ZMIX[zn]);
      let bw=type==='estate'?34+rnd()*8:type==='shops'?16+rnd()*8:9+rnd()*5, bd=type==='estate'?26:type==='shops'?12:13;
      if(s+bw>s1){ if(type==='estate'){ type='tong'; bw=9+rnd()*5; bd=13; } if(s+bw>s1) bw=s1-s; if(bw<7) break; }
      const L=(lx,lz)=>[x+ux*lx+nx*(off+lz),z+uz*lx+nz*(off+lz)];
      const c=[L(0,0),L(bw,0),L(bw,bd),L(0,bd)];
      const underHW=[[0,0],[bw/2,0],[bw,0],[0,bd/2],[bw/2,bd/2],[bw,bd/2],[0,bd],[bw/2,bd],[bw,bd],[bw/2,-1.8]].some(([lx,lz])=>{ const p=L(lx,lz); return ELEV(p[0],p[1],8)>0.02; });   // 高架路底／旁邊唔起樓（會變空氣牆）
      const nearJ=[[0,-1.8],[bw,-1.8],[0,bd],[bw,bd]].some(([lx,lz])=>{ const p=L(lx,lz); return J3.some(n=>{ const N=NODES[n]; return Math.hypot(N[0]-p[0],N[1]-p[1])<NW[n]+r.w/2+3; }); });   // 唔好起到路口轉角入面
      if(!underHW&&!nearJ&&quadFree(c,0.5)){ boxQ([L(0,-1.8),L(bw,-1.8),L(bw,0.2),L(0,0.2)],0,0.11,walkMat,walkMat); const orig=()=>{ if(type==='tong') buildTong(c,L(bw/2,0),nx,nz); else if(type==='shops') buildShops(c); else buildEstate(L,bw,bd); }; if(PCB) PCB.street(type,zn,c,orig); else orig(); DFRONT.push({c,type,h:MAP.blds[MAP.blds.length-1].h,pc:PCB?PCB.last:null}); s+=bw+0.3; }
      else s+=3; } }); });
const VCOL=['#fff1d6','#e8f4ff','#ffe3e3','#e9f7df','#f3e8ff'];
const villageMats=VCOL.map((w,k)=>texMat('v'+k,canvasTex(128,96,(g,W,H)=>{ g.fillStyle=w; g.fillRect(0,0,W,H); g.fillStyle='#8fb8d8'; g.fillRect(20,24,34,30); g.fillRect(74,24,34,30); g.fillStyle='#c9b8a6'; g.fillRect(0,H-6,W,6); g.fillStyle='rgba(0,0,0,.15)'; g.fillRect(20,52,34,4); g.fillRect(74,52,34,4); })));
if(REGION==='sr'){ // ===== 🗺️ 沙田實景：OpenStreetMap 真實道路、河道同樓宇輪廓（縮細 0.4 倍）；救護站、消防局、醫院等地標喺真實位置 =====
const SRD=window.SR_DATA, SRP=SRD.pl;
const srPip=(x,z,P)=>{ let c=false; for(let i=0,j=P.length-1;i<P.length;j=i++){ const xi=P[i][0],zi=P[i][1],xj=P[j][0],zj=P[j][1]; if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi) c=!c; } return c; };
const srTri=P=>THREE.ShapeUtils.triangulateShape(P.map(p=>new THREE.Vector2(p[0],p[1])),[]);
const srHas=names=>names&&MAP.roads.some(r=>!r.bridge&&names.includes(r.name));
const srFlt=names=>srHas(names)?(r=>names.includes(r.name)):null;
const srEdge=(x,z,names)=>nearestEdge(x,z,srFlt(names));
// 多邊形樓宇（多邊形已經統一方向）：牆逐條邊、天台三角化，合併入同一批幾何
function boxP(P,y0,y1,sideMat,topMat,us=8,vs=3,noTop=false){
  if(!topMat||topMat===roofMat){ const cx=P[0][0], cz=P[0][1]; topMat=roofMats[Math.abs((cx*7+cz*13)|0)%roofMats.length]; }
  const sb=bucket(sideMat), tb=bucket(topMat); let u=0; const v1=(y1-y0)/vs;
  for(let i=0;i<P.length;i++){ let A=P[i], B=P[(i+1)%P.length]; const ex=B[0]-A[0], ez=B[1]-A[1], L=Math.hypot(ex,ez); if(L<0.05) continue;
    const nx=ez/L, nz=-ex/L; if(ex*nz+ez*(-nx)<0){ const t=A; A=B; B=t; }
    const u0=u/us, u1=(u+L)/us; u+=L;
    sb.p.push(A[0],y0,A[1], B[0],y0,B[1], B[0],y1,B[1],  A[0],y0,A[1], B[0],y1,B[1], A[0],y1,A[1]);
    for(let k=0;k<6;k++) sb.n.push(nx,0,nz);
    sb.u.push(u0,0, u1,0, u1,v1,  u0,0, u1,v1, u0,v1); }
  const T=srTri(P); if(noTop) return T;
  T.forEach(([a,b,c])=>{ let A=P[a],B=P[b],C=P[c]; const y=(B[1]-A[1])*(C[0]-A[0])-(B[0]-A[0])*(C[1]-A[1]); const Q=y>=0?[A,B,C]:[A,C,B];
    Q.forEach(p=>{ tb.p.push(p[0],y1,p[1]); tb.n.push(0,1,0); tb.u.push(p[0]/8,p[1]/8); }); });
  return T; }
// 碰撞：每個天台三角形登記入格網（同 addBldQ 一樣用 BIDX 精準判斷）
function addBldP(P,T,h,lm){ MAP.blds.push({p:P,h,lm});
  T.forEach(([a,b,c])=>{ const A=P[a],B=P[b],C=P[c], cx=(A[0]+B[0]+C[0])/3, cz=(A[1]+B[1]+C[1])/3;
    const cc=[A,B,C,C].map(([x,z])=>{ const dx=x-cx,dz=z-cz,L=Math.hypot(dx,dz)||1; return [x+dx/L*0.3,z+dz/L*0.3]; });
    quadCells([A,B,C,C],k=>{ if(k<0) return; if((grid[k]&2)&&!BIDX.has(k)) OTH[k]=1; grid[k]|=2; let a2=BIDX.get(k); if(!a2) BIDX.set(k,a2=[]); if(!a2.includes(cc)) a2.push(cc); }); }); }
// 路邊招牌（兩支柱）
function srSign(x,z,text,col,names,w=12){ const E=srEdge(x,z,names); const f=frameAt(E.R,E.nx,E.nz,E.r.w/2+3.6+0.3);
  labelPlane(text,0,3.4,0.2,Math.PI,col,w,f.g); [-w/2+0.6,w/2-0.6].forEach(o=>add(new THREE.BoxGeometry(0.25,2.2,0.25),M(0x6b7280),f.g,o,1.1,0.25,false)); return f; }
// 個案地點：病人企喺行人路，救護車停喺佢嗰邊嘅行車線
function srSpot(key,x,z,names,dx=-3){ const E=srEdge(x,z,names); const f=frameAt(E.R,E.nx,E.nz,E.r.w/2+3.6+0.4); f.E=E;
  LMK[key]={patient:f.L(dx,-2.2),stop:curbStop(f,dx-4),place:[x,z]}; MAP.poi[key]=f.L(0,8); return f; }

// ---------- 沙田救護站（源禾路24號）：源禾路盡頭迴旋處入面，隔籬係沙田區消防總局同直升機坪 ----------
// 沙田救護站同沙田區消防總局：喺源禾路盡頭迴旋處入面背對背（救護站向一邊條路、消防局向另一邊），搵一個兩座都放得落嘅位置
{ const P=SRP.depot.p, PF=SRP.fire.p, flt=srFlt(['源禾路']), DS=0.58, FS=0.48, dw=26, dd=22, fw=28, fd=13.4, gap=0.6;
  const free=(Q,mask)=>quadCells(Q,q=>!(q<0||(grid[q]&mask)));
  let best=null;
  for(let zz=-30;zz<=30;zz+=3) for(let xx=-30;xx<=30;xx+=3){ const E=nearestEdge(P[0]+xx,P[1]+zz,flt); const off=E.r.w/2+3.6+0.4, nx=E.nx, nz=E.nz, ux=nz, uz=-nx;
    const F=[E.R[0]+nx*off,E.R[1]+nz*off], L=(lx,lz)=>[F[0]+ux*lx+nx*lz,F[1]+uz*lx+nz*lz];
    if(!free([L(-dw/2,1),L(dw/2,1),L(dw/2,dd),L(-dw/2,dd)],1|4|8)) continue;
    if(!free([L(-fw/2,dd+gap),L(fw/2,dd+gap),L(fw/2,dd+gap+fd),L(-fw/2,dd+gap+fd)],1|4|8)) continue;
    const dc=L(0,dd/2), fc=L(0,dd+gap+fd/2), cost=Math.hypot(dc[0]-P[0],dc[1]-P[1])+Math.hypot(fc[0]-PF[0],fc[1]-PF[1]);
    if(!best||cost<best.cost) best={E,off,cost}; }
  let f;
  if(best){ f=frameAt(best.E.R,best.E.nx,best.E.nz,best.off); f.E=best.E; markQuad(f.rq(-dw/2-2,-2,dw/2+2,dd+1),8); boxQ(f.rq(-dw/2,0,dw/2,dd),0,0.32,lotMat,lotMat); }
  else f=placeLM(P[0],P[1],dw,dd,flt);
  const D=buildDepotST(f,DS,4);   // 真實外觀：單層開放式車房
  LMK.parkedAmb=D.parked; LMK.parkedAmb.forEach(([p,a])=>markRect(p,a,2.6,6.6)); LMK.depot={pos:D.pos,a:D.a}; MAP.poi.depot=f.L(0,10);
  let g;
  if(best){ g=frameAt(f.L(0,dd+gap+fd),-f.nx,-f.nz,0); g.E=f.E; markQuad(g.rq(-fw/2-1,-1,fw/2+1,fd),8); boxQ(g.rq(-fw/2,0,fw/2,fd),0,0.32,lotMat,lotMat); console.log('[沙田實景] 救護站同消防局背對背'); }
  else g=placeBeside(f,dw/2,fw,fd,1)||placeLM(PF[0],PF[1],fw,fd,flt);
  buildFireST(g,FS,5); }
{ const P=SRP.heli.p; if(P){ let ok=true; for(let a=0;a<6.28;a+=0.5) for(const r of [0,3,6]) if(cellAt(P[0]+Math.cos(a)*r,P[1]+Math.sin(a)*r)&(1|2|4|8)) ok=false;
  if(ok){ const pad=add(new THREE.CylinderGeometry(6,6,0.12,28),M(0x58606b),scene,P[0],0.2,P[1],false); const H=labelPlane('H',P[0],0.3,P[1],0,'#58606b',7); H.rotation.x=-Math.PI/2;
    const ring=add(new THREE.RingGeometry(5.2,5.6,28),new THREE.MeshBasicMaterial({color:0xffd23f}),scene,P[0],0.28,P[1],false); ring.rotation.x=-Math.PI/2;
    for(let zz=-7;zz<=7;zz+=CELL) for(let xx=-7;xx<=7;xx+=CELL) if(Math.hypot(xx,zz)<7){ const q=gi(P[0]+xx,P[1]+zz); if(q>=0) grid[q]|=8; } } } }
// ---------- 田心救護站（富健街2號）----------
{ const P=SRP.tinsum.p; const f=placeLM(P[0],P[1],38,28,srFlt(['富健街','顯徑街','車公廟路'])); const D=buildDepotTS(f,0.7); LMK.depotTS={pos:D.pos,a:D.a}; MAP.poi.depotTS=f.L(0,14); }
// ---------- 威爾斯親王醫院急症室（銀城街，住院主樓暨創傷中心）----------
{ const P=(SRP.pwhtc||SRP.pwh).p; const f=placeLM(P[0],P[1],44,34,srFlt(['銀城街']));
  markQuad(f.rq(-15,-4,15,22),1); boxQ(f.rq(-15,0,15,22),0,0.33,M(0xa9b0ba,{r:0.9}),M(0xa9b0ba,{r:0.9}));   // 救護車車道
  const hm=texMat('hospSR',housingTex('#eef1f6','#1f5fa8',2)); const c=f.rq(-21,22,21,33); boxQ(c,0.3,26,hm,roofMat,8,3); addBldQ(c,26,'hospital');
  add(new THREE.BoxGeometry(24,0.6,9),M(0x8fd3c7),f.g,0,5.2,17.5,true); [-10,10].forEach(o=>add(new THREE.CylinderGeometry(0.35,0.35,5,10),M(0xd0d4da),f.g,o,2.6,13.4,true));
  labelPlane('威爾斯親王醫院',0,17,21.9,Math.PI,'#1f5fa8',24,f.g); labelPlane('急症室 A&E',0,8.6,21.9,Math.PI,'#d62839',16,f.g);
  add(new THREE.CylinderGeometry(6,6,0.4,28),M(0x58606b),f.g,-11,26.5,28,false); labelPlane('H',-11,26.75,28,0,'#58606b',7,f.g).rotation.x=-Math.PI/2;
  LMK.ae={door:f.L(0,21),stop:f.L(0,11),poi:f.L(0,28)}; MAP.poi.hospital=LMK.ae.poi; MAP.poi.ae=[f.L(0,22)]; }
// ---------- 車公廟（車公廟路）：紅牆黃瓦 ----------
{ const f=placeLM(-329,495,40,32,srFlt(['車公廟路']));
  boxQ(f.rq(-20,0,20,32),0,0.3,M(0xd9c7a3,{r:0.95}),M(0xd9c7a3,{r:0.95}));
  const t=new THREE.Group(); t.position.set(0,0.3,19); f.g.add(t);
  add(new THREE.BoxGeometry(17,6,10),M(0xb22a1e),t,0,3,0,true); const rf=add(new THREE.ConeGeometry(12.5,4,4),M(0xe2b13c),t,0,8,0,true); rf.rotation.y=Math.PI/4; rf.scale.set(1,1,0.62);
  add(new THREE.BoxGeometry(4,4.5,1),M(0x6b1d14),t,0,2.3,5.05,false); markSeg(f.L(0,19),f.L(0,19),19,2);
  labelPlane('車公廟',0,4,0.6,Math.PI,'#b22a1e',11,f.g); }
// ---------- 曾大屋（客家圍村，沙角街旁）----------
{ const f=placeLM(-75,392,44,40,srFlt(['沙角街','大涌橋路']));
  const wm=M(0x8e96a0,{r:0.9}); const o=[-20,4,20,38]; [[o[0],o[1],o[2],o[1]+2],[o[0],o[3]-2,o[2],o[3]],[o[0],o[1],o[0]+2,o[3]],[o[2]-2,o[1],o[2],o[3]]].forEach(([a,b,c,d])=>{ const q=f.rq(a,b,c,d); boxQ(q,0.3,7,wm,M(0x5f666e),6,3); addBldQ(q,7); });
  [[o[0],o[1]],[o[2]-5,o[1]],[o[0],o[3]-5],[o[2]-5,o[3]-5]].forEach(([a,b])=>{ const q=f.rq(a,b,a+5,b+5); boxQ(q,0.3,11,wm,M(0x4c535a),3,4); });
  boxQ(f.rq(-4,3.9,4,4.2),0.3,4.5,M(0x3a2a20),M(0x3a2a20)); labelPlane('曾大屋',0,9,3.6,Math.PI,'#5f666e',11,f.g); }
// ---------- 萬佛寺（排頭村山上）：山門喺路邊，九層萬佛塔喺後山 ----------
{ const f=placeLM(-244,-151,30,20,srFlt(['排頭街','沙田正街']));
  const gate=new THREE.Group(); gate.position.set(0,0.3,6); f.g.add(gate);
  [-5,5].forEach(x=>add(new THREE.BoxGeometry(1,7,1),M(0xb22a1e),gate,x,3.5,0,false)); add(new THREE.BoxGeometry(13,1.4,2),M(0xe2b13c),gate,0,7.5,0,false);
  labelPlane('萬佛寺',0,9.4,1.1,Math.PI,'#b22a1e',9,gate);
  const H=[-244,-151]; let hx=H[0], hz=H[1]; { const d=Math.hypot(hx-f.F[0],hz-f.F[1]); if(d<40){ hx=f.F[0]+f.nx*55; hz=f.F[1]+f.nz*55; } }
  let ok=true; for(let a=0;a<6.28;a+=0.4) if(cellAt(hx+Math.cos(a)*30,hz+Math.sin(a)*30)&(1|4)) ok=false;
  if(ok){ hillQ(hx,hz,38,30,34,0.4,M(0x5d8f4e,{r:0.95})); for(let zz=hz-38;zz<=hz+38;zz+=CELL) for(let xx=hx-38;xx<=hx+38;xx+=CELL) if(Math.hypot(xx-hx,zz-hz)<36){ const q=gi(xx,zz); if(q>=0&&!(grid[q]&1)) grid[q]|=2|8; }
    const pg=new THREE.Group(); pg.position.set(hx,28,hz); scene.add(pg);
    for(let i=0;i<9;i++){ const r=3.4-i*0.26, y=i*2.6; add(new THREE.CylinderGeometry(r*0.9,r,2.2,8),M(0xc8382a),pg,0,y+1.1,0,i<2); add(new THREE.CylinderGeometry(r*0.6,r*1.18,0.5,8),M(0xe2b13c),pg,0,y+2.4,0,false); }
    add(new THREE.ConeGeometry(0.9,2.6,8),M(0xe2b13c),pg,0,24.6,0,false); } }

// ---------- OSM 樓宇（約 3,000 座）：按類型揀外牆 ----------
{ const B=SRD.b; const K=['h','v','i','s','c','o','p'];
  const indMat=texMat('srInd',canvasTex(128,64,(g,w,h)=>{ g.fillStyle='#c9cdd2'; g.fillRect(0,0,w,h); g.fillStyle='#8a97a3'; for(let y=8;y<h;y+=20) g.fillRect(0,y,w,8); g.fillStyle='#b1b7be'; g.fillRect(0,h-4,w,4); }));
  const schMat=texMat('srSch',canvasTex(128,64,(g,w,h)=>{ g.fillStyle='#f3ead2'; g.fillRect(0,0,w,h); g.fillStyle='#7fa7c9'; for(let x=6;x<w;x+=24) g.fillRect(x,14,16,22); g.fillStyle='#d9534f'; g.fillRect(0,h-8,w,8); }));
  const offMat=texMat('srOff',canvasTex(128,64,(g,w,h)=>{ g.fillStyle='#6f8fae'; g.fillRect(0,0,w,h); g.fillStyle='#a9c4dc'; for(let y=4;y<h;y+=16) for(let x=4;x<w;x+=16) g.fillRect(x,y,12,10); }));
  const civMat=texMat('srCiv',canvasTex(128,64,(g,w,h)=>{ g.fillStyle='#eef1f4'; g.fillRect(0,0,w,h); g.fillStyle='#2a7ab8'; g.fillRect(0,0,w,6); g.fillStyle='#93b0c4'; for(let x=8;x<w;x+=30) g.fillRect(x,18,20,24); }));
  const hospMat=texMat('hospSR',housingTex('#eef1f6','#1f5fa8',2));
  const pw=SRP.pwh.p; let i=0, n=0, sk=0;
  while(i<B.length){ const k=K[B[i]], h=B[i+1]/2, cnt=B[i+2]; let x=B[i+3], z=B[i+4]; const P=[[x/2,z/2]]; i+=5;
    for(let j=1;j<cnt;j++){ x+=B[i]; z+=B[i+1]; i+=2; P.push([x/2,z/2]); }
    // 壓到馬路、河、地標地盤就唔起
    let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9; P.forEach(([a,b])=>{x0=Math.min(x0,a);x1=Math.max(x1,a);z0=Math.min(z0,b);z1=Math.max(z1,b);});
    let tot=0, bad=0, soft=0; const st=Math.max(0.8,Math.min(2,(x1-x0+z1-z0)/16));
    for(let zz=z0+st/2;zz<z1;zz+=st) for(let xx=x0+st/2;xx<x1;xx+=st) if(srPip(xx,zz,P)){ tot++; const g=cellAt(xx,zz); if(g&(1|4|8)) bad++; else if(g&(2|16)) soft++; }
    if(!tot||bad>tot*0.06||soft>tot*0.35){ sk++; continue; }
    const hs=Math.abs((P[0][0]*7+P[0][1]*13)|0);
    // 香港街景「上舖下居」：只有地下一層係舖頭（招牌、閘），樓上係住宅／寫字樓窗
    let side, us=8, shop=false;
    if(k==='h') side=housingMats[hs%housingMats.length];
    else if(k==='v'){ side=villageMats[hs%villageMats.length]; us=6; }
    else if(k==='i') side=indMat;
    else if(k==='s') side=schMat;
    else if(k==='c'){ shop=true; if(h>18) side=offMat; else { side=tongMats[hs%tongMats.length]; us=8.5; } }
    else if(k==='p') side=Math.hypot(P[0][0]-pw[0],P[0][1]-pw[1])<90?hospMat:civMat;
    else if(h>24) side=housingMats[hs%housingMats.length];
    else if(h>9){ side=tongMats[hs%tongMats.length]; us=8.5; shop=true; }
    else side=villageMats[hs%villageMats.length];
    if(shop&&h>7){ boxP(P,0,4.8,shopMats[hs%shopMats.length],null,24,4.5,true); }
    const T=shop&&h>7?boxP(P,4.8,h,side,roofMat,us,3):boxP(P,0,h,shop?shopMats[hs%shopMats.length]:side,roofMat,shop?24:us,shop?4.5:3); addBldP(P,T,h,k==='p'&&Math.hypot(P[0][0]-pw[0],P[0][1]-pw[1])<90?'hospital':null); n++; }
  console.log('[沙田實景] 樓宇',n,'略過',sk); }
// ---------- 公園、球場、跑道（真實位置）----------
{ const g=[], p=[], t=[];
  SRD.green.forEach(([ty,P])=>{ if(P.length<3) return; const T=srTri(P), arr=ty==='p'?p:ty==='t'?t:g;
    T.forEach(([a,b,c])=>arr.push(P[a][0],0,P[a][1],P[b][0],0,P[b][1],P[c][0],0,P[c][1]));
    if(ty==='g'){ MAP.parks.push(P); let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9; P.forEach(([a,b])=>{x0=Math.min(x0,a);x1=Math.max(x1,a);z0=Math.min(z0,b);z1=Math.max(z1,b);});
      const area=(x1-x0)*(z1-z0), m=Math.min(30,area/160|0);
      for(let q=0,tr=0;q<m&&tr<m*4;tr++){ const x=x0+rnd()*(x1-x0), z=z0+rnd()*(z1-z0); if(!srPip(x,z,P)||cellAt(x,z)||cellAt(x+2,z)||cellAt(x-2,z)) continue; props.tree.push([x,z,0,0.06]); q++; } } });
  flat(g,M(0x9fd77c,{r:0.95}),0.06); flat(t,M(0xc0503a,{r:0.95}),0.066); flat(p,M(0x5fae4a,{r:0.95}),0.074); }
// ---------- 山：真實樹林範圍＋離馬路遠嘅地方 ----------
{ const Wm=SRD.wood, wm=new Uint8Array(Wm.w*Wm.h); { let o=0,v=0; for(const r of Wm.r){ if(v) wm.fill(1,o,o+r); o+=r; v^=1; } }
  const woodAt=(x,z)=>{ const i=Math.floor((x-Wm.x0)/Wm.c), j=Math.floor((z-Wm.z0)/Wm.c); return i>=0&&j>=0&&i<Wm.w&&j<Wm.h&&wm[j*Wm.w+i]; };
  const hm=[M(0x7fb069,{r:0.95}),M(0x6a9f58,{r:0.95}),M(0x8cbf73,{r:0.95}),M(0x5d8f4e,{r:0.95})];
  const rd=(x,z)=>{ const E=nearestEdge(x,z); return Math.hypot(E.R[0]-x,E.R[1]-z); };
  const tryH=(x,z,r,h)=>{ for(let a=0;a<6.28;a+=0.45) for(const q of [0,0.3,0.65,1]) if(cellAt(x+Math.cos(a)*r*q,z+Math.sin(a)*r*q)&(1|2|4|8|16)) return;
    hillQ(x,z,r,h,r*(0.75+rnd()*0.5),rnd()*6,pick(hm));
    for(let zz=z-r;zz<=z+r;zz+=CELL) for(let xx=x-r;xx<=x+r;xx+=CELL) if(Math.hypot(xx-x,zz-z)<r*0.95){ const q=gi(xx,zz); if(q>=0) grid[q]|=2|8; }
    for(let t=0;t<2;t++){ const a=rnd()*6.28, d=r*(0.15+rnd()*0.4); props.tree.push([x+Math.cos(a)*d,z+Math.sin(a)*d,0,h*0.75]); } return true; };
  let nH=0; for(let z=BZ0+14;z<BZ1-8;z+=32) for(let x=BX0+14;x<BX1-8;x+=32){ const xx=x+(rnd()-0.5)*12, zz=z+(rnd()-0.5)*12; const d=rd(xx,zz), w=woodAt(xx,zz);
    if(d<42||(!w&&d<85)) continue; const k=Math.min(1,(d-42)/260);
    if(tryH(xx,zz,20+rnd()*14+k*26,10+rnd()*10+k*55)) nH++; } console.log('[沙田實景] 山',nH); }
// ---------- 路邊招牌（地標名）----------
[['沙田划艇中心',[400,-322],'#2a7ab8',['源禾路']],['香港體育學院',[422,-386],'#d62839',['源禾路','火炭路']],['沙田運動場',[263,-137],'#2a7ab8',['源禾路']],
 ['沙田大會堂',[-49,150],'#8a6e4b',['源禾路','白鶴汀街']],['新城市廣場',[-114,156],'#e94e1b',['沙田正街','白鶴汀街']],['沙田站',[-130,59],'#3a8fc4',['沙田正街','橫壆街']],
 ['沙田公園',[-29,180],'#46a35e',['源禾路']],['香港文化博物館',[-216,318],'#6d6a63',['大涌橋路','文林路']],['禾輋廣場',[174,-153],'#e07a1f',['德厚街','禾輋街']],
 ['沙田第一城',[508,-73],'#5aa9e6',['銀城街','寶城街']],['小瀝源消防局',[574,52],'#c1121f',['源順圍','小瀝源路']],
 ['大圍站',[-512,507],'#3a8fc4',['大圍道','車公廟路']],['火炭站',[295,-479],'#3a8fc4',['火炭路','山尾街']],['第一城站',[511,76],'#3a8fc4',['銀城街','牛皮沙街']]]
 .forEach(([t,[x,z],c,nm])=>{ try{ srSign(x,z,t,c,nm,Math.max(9,t.length*1.6)); }catch(e){} });
// ---------- 個案地點（全部係沙田真實地址）----------
srSpot('stpark',-29,180,['源禾路']); srSpot('stck',-329,495,['車公廟路']); srSpot('stntp',-114,156,['沙田正街','白鶴汀街']);
srSpot('stcity',508,-73,['銀城街','寶城街']); srSpot('strace',422,-386,['源禾路','火炭路']); srSpot('stbuddha',-244,-151,['排頭街','沙田正街']);
srSpot('stsport',263,-137,['源禾路']); srSpot('stwoche',174,-153,['德厚街','禾輋街']); srSpot('ststn',-130,59,['沙田正街','橫壆街']);
srSpot('sttsang',-75,392,['沙角街','大涌橋路']); srSpot('sttownh',-49,150,['源禾路','白鶴汀街']);
 }
// 郊區山丘（元朗公路兩邊）：高架附近唔起樓，改為一層層山
function hwDist(x,z){ let best=1e9; for(const T of HWS) for(let i=1;i<T.pts.length;i++){ const A=T.pts[i-1],B=T.pts[i], dx=B[0]-A[0], dz=B[1]-A[1], L2=dx*dx+dz*dz||1; let t=((x-A[0])*dx+(z-A[1])*dz)/L2; t=t<0?0:t>1?1:t; best=Math.min(best,Math.hypot(x-A[0]-dx*t,z-A[1]-dz*t)); } return best; }
const nearHW=(x,z)=>rural(x,z)&&hwDist(x,z)<175;
{ const hm=[M(0x7fb069,{r:0.95}),M(0x6a9f58,{r:0.95}),M(0x8cbf73,{r:0.95}),M(0x5d8f4e,{r:0.95})];
  const tryHill=(x,z,r,h)=>{ if(REGION==='tm'&&(!rural(x,z)||z-r<-830)) return; for(let a=0;a<6.28;a+=0.45) for(const q of [0.3,0.65,1]) if(cellAt(x+Math.cos(a)*r*q,z+Math.sin(a)*r*q)&(1|4|8|16)) return;
    hillQ(x,z,r,h,r*(0.75+rnd()*0.5),rnd()*6,pick(hm));
    for(let zz=z-r;zz<=z+r;zz+=CELL) for(let xx=x-r;xx<=x+r;xx+=CELL) if(Math.hypot(xx-x,zz-z)<r*0.95){ const q=gi(xx,zz); if(q>=0) grid[q]|=2|8; }
    for(let t=0;t<3;t++){ const a=rnd()*6.28, d=r*(0.15+rnd()*0.4); props.tree.push([x+Math.cos(a)*d,z+Math.sin(a)*d,0,h*0.75]); } };
  for(const HL of HWS) for(let s=10;s<HL.L;s+=16) for(const sd of [-1,1]) for(const [o0,o1,r0,r1,h0,h1] of [[30,60,12,20,7,14],[70,120,20,32,14,26],[130,175,28,42,22,40]]){
    const k=Math.max(1,Math.min(HL.pts.length-1,HL.cum.findIndex(c=>c>=s))); const A=HL.pts[k-1],B=HL.pts[k]; const [ux,uz]=dirn(A,B); const nx=uz*sd, nz=-ux*sd;
    const off=o0+rnd()*(o1-o0), x=A[0]+ux*(rnd()-0.5)*14+nx*off, z=A[1]+uz*(rnd()-0.5)*14+nz*off; tryHill(x,z,r0+rnd()*(r1-r0),h0+rnd()*(h1-h0)); }
  // 沙田：谷地四周係山（離馬路遠過 75 米嘅地方起山，越遠越高）
  if(REGION==='st'){ const rd=(x,z)=>{ const E=nearestEdge(x,z); return E?Math.hypot(E.R[0]-x,E.R[1]-z):1e9; };
    northWild=(x,z)=>rd(x,z)>75;
    for(let z=BZ0+10;z<BZ1;z+=30) for(let x=BX0+10;x<BX1;x+=30){ const d=rd(x,z); if(d<85||riverDist(x,z)<RIVH+30) continue; const k=Math.min(1,(d-85)/220);
      tryHill(x+(rnd()-0.5)*14,z+(rnd()-0.5)*14,22+rnd()*18+k*26,12+rnd()*14+k*60); } } }
// 北面郊野（天水圍以外）：一格格魚塘（平面幾何，好慳效能）
{ const bank=[], water=[];
  for(let z=BZ0+16;z<-850;z+=27) for(let x=BX0+16;x<BX1-16;x+=33){ if(!northWild(x,z)) continue; const w=26+rnd()*4, d=20+rnd()*3;
    const c=rectQ(x-w/2,z-d/2,x+w/2,z+d/2); if(!quadFree(c,3)) continue; const E=nearestEdge(x,z); if(Math.hypot(E.R[0]-x,E.R[1]-z)<E.r.w/2+18) continue;
    quadA(bank,c); quadA(water,rectQ(x-w/2+1.6,z-d/2+1.6,x+w/2-1.6,z+d/2-1.6)); markQuad(c,4|8); }
  if(bank.length){ flat(bank,M(0x9fb487,{r:0.95}),0.02); flat(water,M(0x5aa7c8,{r:0.6}),0.06); } }
// 內街空地：補屋邨高樓或小公園（郊區就用低層建築、停車場、草地）
if(REGION!=='sr') for(let z=BZ0+20;z<BZ1-20;z+=20) for(let x=BX0+20;x<BX1-20;x+=20){
  const E=nearestEdge(x,z); const ang=Math.atan2(E.nx,E.nz); const ux=Math.cos(ang), uz=-Math.sin(ang), nx=E.nx, nz=E.nz;
  const L=(lx,lz)=>[x+ux*lx+nx*lz,z+uz*lx+nz*lz];
  const c=[L(-11,-9),L(11,-9),L(11,9),L(-11,9)]; if(!quadFree(c,3)) continue; const rur=rural(x,z), q=rnd();
  if(northWild(x,z)){ if(rnd()<0.12) props.tree.push([x+(rnd()-0.5)*16,z+(rnd()-0.5)*14,0,0]); continue; }
  if(nearHW(x,z)){ if(rnd()<0.3) props.tree.push([x+(rnd()-0.5)*16,z+(rnd()-0.5)*14,0,0]); continue; }
  if(rur&&q<0.25){ const h=8+rnd()*8; const cc=[L(-9,-7),L(9,-7),L(9,7),L(-9,7)]; boxQ(cc,0,h,pick(villageMats),roofMat,8,3); addBldQ(cc,h); boxQ(c,0,0.25,podMat,podMat); markQuad(c,8); }
  else if(rur&&q>0.6){ boxQ(c,0,0.25,grassMat,grassMat); markQuad(c,8); for(let k=0;k<3;k++) props.tree.push([x+(rnd()-0.5)*18,z+(rnd()-0.5)*14,0,0.25]); }
  else if(!rur&&rnd()<0.75){ const h=26+rnd()*20, iq=[L(-8,-7),L(8,-7),L(8,7),L(-8,7)], hm=pick(housingMats); const hh=PCB?PCB.inner(iq,h):(boxQ(iq,0,h,hm,roofMat,8,3),h); addBldQ(iq,hh);
    boxQ(c,0,0.25,podMat,podMat); markQuad(c,8); }
  else if(rur||rnd()<0.5){ boxQ(c,0,0.25,M(0x8a919c,{r:0.9}),M(0x8a919c,{r:0.9})); markQuad(c,8); // 停車場
    for(let k=0;k<4;k++) for(const r of [-1,1]){ const p=L(-7.5+k*5,r*4.5); parked.push([p[0],p[1],Math.atan2(nx*r,nz*r)]); markRect(p,Math.atan2(nx*r,nz*r),2.1,4.8); } }
  else { boxQ(c,0,0.25,grassMat,grassMat); markQuad(c,8); for(let k=0;k<4;k++) props.tree.push([x+(rnd()-0.5)*18,z+(rnd()-0.5)*14,0,0.25]); } }
// 再細啲嘅空位：村屋／低層樓

if(REGION!=='sr') for(let z=BZ0+10;z<BZ1-10;z+=11) for(let x=BX0+10;x<BX1-10;x+=11){
  const xx=x+(rnd()-0.5)*4, zz=z+(rnd()-0.5)*4; const E=nearestEdge(xx,zz); const ux=E.nz, uz=-E.nx;
  const w=7+rnd()*3, d=7+rnd()*3; const L=(lx,lz)=>[xx+ux*lx+E.nx*lz,zz+uz*lx+E.nz*lz]; const c=[L(-w/2,-d/2),L(w/2,-d/2),L(w/2,d/2),L(-w/2,d/2)];
  if(!quadFree(c,1.5)||nearHW(xx,zz)||northWild(xx,zz)) continue; if(xx>150&&xx<375&&zz<-850&&zz>-1050){ const h=30+(rnd()*5|0)*6; boxQ(c,0,h,pick(housingMats),roofMat,8,3); addBldQ(c,h); continue; } const h=6+(rnd()*3|0)*3; boxQ(c,0,h,pick(villageMats),roofMat,8,3); addBldQ(c,h); }
// 剩低嘅草地：散樹
for(let k=0;k<500;k++){ const x=BX0+rnd()*(BX1-BX0), z=BZ0+rnd()*(BZ1-BZ0); if(!cellAt(x,z)&&!cellAt(x+3,z)&&!cellAt(x-3,z)) props.tree.push([x,z,0,0]); }
// 地圖邊界：出面一直係障礙（以前睇唔到，似空氣牆）→ 沿邊界起一道石屎矮牆；馬路穿過邊界嘅位置改用紅白封路欄
{ const wallM=M(0xb3b6b9,{r:0.9}), capM=M(0x8b9096,{r:0.8});
  const barT=canvasTex(128,64,(g,w,h)=>{ g.fillStyle='#fff'; g.fillRect(0,0,w,h); g.fillStyle='#d62828'; for(let x=-h;x<w+h;x+=32){ g.beginPath(); g.moveTo(x,0); g.lineTo(x+16,0); g.lineTo(x+16+h,h); g.lineTo(x+h,h); g.fill(); } });
  const barM=new THREE.MeshStandardMaterial({map:barT,roughness:0.6});
  const side=(x0,z0,x1,z1,nx,nz)=>{ const L=Math.hypot(x1-x0,z1-z0), ux=(x1-x0)/L, uz=(z1-z0)/L; for(let s=0;s<L;s+=4){ const e=Math.min(L,s+4), mx=x0+ux*(s+e)/2, mz=z0+uz*(s+e)/2;
      const ix=mx+nx*1.5, iz=mz+nz*1.5, g=cellAt(ix,iz); if(g&4||ELEV(mx,mz,6)>0.3) continue;   // 河／海唔使牆；高架路底唔起
      const A=[x0+ux*s,z0+uz*s], B=[x0+ux*e,z0+uz*e], C=[B[0]-nx*0.5,B[1]-nz*0.5], D=[A[0]-nx*0.5,A[1]-nz*0.5];
      if(g&1){ boxQ([A,B,C,D],0,1.25,barM,barM,4,1.25); }
      else { boxQ([A,B,C,D],0,1.1,wallM,capM,4,1.1); boxQ([[A[0]+nx*0.05,A[1]+nz*0.05],[B[0]+nx*0.05,B[1]+nz*0.05],[C[0]-nx*0.05,C[1]-nz*0.05],[D[0]-nx*0.05,D[1]-nz*0.05]],1.1,1.25,capM,capM,4,1); } } };
  side(BX0,BZ0,BX1,BZ0,0,1); side(BX1,BZ1,BX0,BZ1,0,-1); side(BX0,BZ1,BX0,BZ0,1,0); side(BX1,BZ0,BX1,BZ1,-1,0); }
flushBuckets(); if(PCB) PCB.finish();

/* ---------- 遠景：外圍樓群、海、山 ---------- */
function farScene(){
  const ring=(d0,d1,hmin,hmax,step,mats)=>{ for(let side=0;side<4;side++){ if(side===1) continue; const horiz=side<2; const a0=horiz?BX0-d1:BZ0-d1, a1=horiz?BX1+d1:BZ1+20;
      for(let a=a0;a<a1;a+=step*(0.8+rnd()*0.6)){ const w=step*(0.55+rnd()*0.3), dd=d0+rnd()*(d1-d0-w), h=hmin+rnd()*(hmax-hmin);
        let x0,z0; if(horiz){ x0=a; z0=BZ0-dd-w; } else { z0=a; x0=side===2?BX0-dd-w:BX1+dd; }
        boxQ(rectQ(x0,z0,x0+w,z0+w),0,h,pick(mats),roofMat,8,3); } } };
  ring(14,44,8,22,26,[...tongMats,...shopMats]); ring(60,150,30,60,30,housingMats); flushBuckets();
  // 南面：青山灣（海）、沙灘、船
  const sea=add(new THREE.PlaneGeometry(2600,1000),new THREE.MeshStandardMaterial({color:0x5fb8e6,roughness:0.3}),scene,(BX0+BX1)/2,0.02,BZ1+560,false); sea.rotation.x=-Math.PI/2;
  const sand=add(new THREE.PlaneGeometry(2600,40),M(0xf3e2b3,{r:1}),scene,(BX0+BX1)/2,0.04,BZ1+40,false); sand.rotation.x=-Math.PI/2;
  for(let k=0;k<7;k++){ const b=new THREE.Group(); b.position.set(BX0-200+k*130,0.4,BZ1+160+rnd()*260); scene.add(b);
    add(new THREE.BoxGeometry(4,1.4,12),M(0xffffff),b,0,0.5,0,false); add(new THREE.BoxGeometry(3,2,4),M([0xe63946,0x457b9d,0xf4a261][k%3]),b,0,2,1,false); b.rotation.y=rnd()*3; }
  const mt=(x,z,r,h,col)=>{ const g=new THREE.ConeGeometry(r*1.3,h*0.75,9,3); const pa=g.attributes.position; for(let q=0;q<pa.count;q++){ const y=pa.getY(q); if(y>-h*0.37&&y<h*0.37){ pa.setX(q,pa.getX(q)*(1.15+rnd()*0.2)); pa.setZ(q,pa.getZ(q)*(1.15+rnd()*0.2)); } } g.computeVertexNormals(); const m=new THREE.Mesh(g,new THREE.MeshLambertMaterial({color:col,flatShading:true,fog:false})); m.position.set(x,h/2-2,z); m.rotation.y=rnd()*3; scene.add(m); };
  const cols=[0x6fae84,0x7dba8c,0x5f9f78,0x86bf96];
  for(let k=0;k<11;k++) mt(BX0-420-rnd()*260, BZ0+k*150-150, 140+rnd()*90, 150+rnd()*170, pick(cols)); // 西：青山
  for(let k=0;k<9;k++) mt(BX0-200+k*150, BZ0-480-rnd()*240, 150+rnd()*90, 120+rnd()*160, pick(cols)); // 北
  for(let k=0;k<11;k++) mt(BX1+440+rnd()*260, BZ0+k*150-120, 140+rnd()*90, 130+rnd()*170, pick(cols)); // 東：九逕山
  mt(BX0-520,BZ0+700,260,380,0x5f9f78); // 青山主峰
  const hedge=[]; for(let x=BX0;x<=BX1;x+=6){ hedge.push([x,BZ0-3,0,0],[x,BZ1+3,0,0]); } for(let z=BZ0;z<=BZ1;z+=6){ hedge.push([BX0-3,z,0,0],[BX1+3,z,0,0]); }
  props.tree.push(...hedge.filter(([x,z])=>!(cellAt(x,z)&1)&&!(cellAt(x+4,z)&1)&&!(cellAt(x-4,z)&1)&&!(cellAt(x,z+4)&1)&&!(cellAt(x,z-4)&1)));
}
farScene(); flushBuckets();

/* ---------- 清走壓住馬路嘅街道物件（樹、街燈） ---------- */
const offRoad=(x,z,r)=>{ for(const [dx,dz] of [[0,0],[r,0],[-r,0],[0,r],[0,-r]]) if(cellAt(x+dx,z+dz)&1) return false; return true; };
props.tree=props.tree.filter(([x,z])=>offRoad(x,z,1.6)&&ELEV(x,z,15)<0.2); props.lamp=props.lamp.filter(([x,z])=>offRoad(x,z,0.8)&&ELEV(x,z,15)<0.2);
/* ---------- 街道物件 ---------- */
// 分區 instancing：每 200 米一格，各自有包圍球，鏡頭睇唔到嘅格就唔畫
const INSTC=[]; // 分區 instancing 清單（遠距離唔畫）
function instanced(geo,mat,list,place,cast=true,far=320){ if(!list.length) return; const groups=new Map();
  list.forEach(it=>{ const k=Math.floor(it[0]/CHUNK)+','+Math.floor(it[1]/CHUNK); if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(it); });
  if(!geo.boundingSphere) geo.computeBoundingSphere(); const gr=geo.boundingSphere.radius+geo.boundingSphere.center.length();
  groups.forEach(items=>{ const g=geo.clone(); const m=new THREE.InstancedMesh(g,mat,items.length); const o=new THREE.Object3D(); const bb=new THREE.Box3();
    items.forEach((it,k)=>{ o.position.set(0,0,0); o.rotation.set(0,0,0); o.scale.set(1,1,1); place(o,it); o.updateMatrix(); m.setMatrixAt(k,o.matrix); bb.expandByPoint(o.position); });
    const sp=new THREE.Sphere(); bb.getBoundingSphere(sp); sp.radius+=gr*2; g.boundingSphere=sp;   // 用成格嘅包圍球做 culling
    m.castShadow=cast; m.receiveShadow=true; m.matrixAutoUpdate=false; scene.add(m); INSTC.push({m,c:sp.center,r:sp.radius,far}); }); }
const tl=props.tree.filter(([x,z])=>offRoad(x,z,1.6));
instanced(new THREE.CylinderGeometry(0.25,0.35,2.2,5,1,true),M(C.trunk),tl,(o,[x,z,,y=0.3])=>o.position.set(x,y+1.1,z),false);
instanced(new THREE.IcosahedronGeometry(1.9,0),M(C.tree,{r:0.9}),tl,(o,[x,z,,y=0.3])=>{o.position.set(x,y+3.2,z);o.scale.setScalar(0.85+((Math.abs(x*13+z*7))%10)/25);});
instanced(new THREE.CylinderGeometry(0.12,0.16,6,6),M(0x6b7380),props.lamp,(o,[x,z])=>o.position.set(x,3.2,z),false);
const LAMPHEAD=M(0xfff6c4,{e:0x555533}); instanced(new THREE.BoxGeometry(0.5,0.3,1.8),LAMPHEAD,props.lamp,(o,[x,z,a])=>{o.position.set(x+Math.sin(a)*0.8,6.1,z+Math.cos(a)*0.8);o.rotation.y=a;},false);
/* ---------- 精細／超精細模式：行人路欄杆、街道設施、霓虹招牌、雨篷、冷氣機、天台水缸 ----------
   全部砌入分區合併網格（每 200 米一格），一格只係幾次繪製；鏡頭睇唔到嘅格唔畫，唔投影。 */
const NEON=(()=>{ if(!GFX) return null;
  const SC0=scene.children.length;   // 之後加入嘅分區網格：遠距離自動唔畫
  const G2=GFX>=2;
  /* ===== 顏色方塊（vertex color）分區桶 ===== */
  const VB=new Map(), _m=new THREE.Matrix4(), _q=new THREE.Quaternion(), _e=new THREE.Euler(), _v=new THREE.Vector3(), _s=new THREE.Vector3(), _c=new THREE.Color(), _n=new THREE.Vector3(), _nm=new THREE.Matrix3();
  const TPL={box:new THREE.BoxGeometry(1,1,1).toNonIndexed(), cyl:new THREE.CylinderGeometry(1,1,1,8).toNonIndexed(), cyl12:new THREE.CylinderGeometry(1,1,1,12).toNonIndexed()};
  const ck=(x,z)=>Math.floor(x/CHUNK)+','+Math.floor(z/CHUNK);
  function put(shape,x,y,z,sx,sy,sz,yaw,hex,pitch=0,roll=0){ let b=VB.get(ck(x,z)); if(!b){ b={p:[],n:[],c:[]}; VB.set(ck(x,z),b); } putB(b,shape,x,y,z,sx,sy,sz,yaw,hex,pitch,roll); }
  function putB(b,shape,x,y,z,sx,sy,sz,yaw,hex,pitch=0,roll=0){
    const T=TPL[shape], P=T.attributes.position, N=T.attributes.normal; _e.set(pitch,yaw,roll,'YXZ'); _q.setFromEuler(_e); _m.compose(_v.set(x,y,z),_q,_s.set(sx,sy,sz)); _nm.getNormalMatrix(_m); _c.setHex(hex);
    for(let i=0;i<P.count;i++){ _v.set(P.getX(i),P.getY(i),P.getZ(i)).applyMatrix4(_m); b.p.push(_v.x,_v.y,_v.z); _n.set(N.getX(i),N.getY(i),N.getZ(i)).applyMatrix3(_nm).normalize(); b.n.push(_n.x,_n.y,_n.z); b.c.push(_c.r,_c.g,_c.b); } }
  const box=(...a)=>put('box',...a), cyl=(x,y,z,r,h,hex,seg)=>put(seg?'cyl12':'cyl',x,y,z,r,h,r,0,hex);
  /* ===== 貼圖四邊形分區桶（欄杆、霓虹） ===== */
  function QB(){ const m=new Map(); return {m,add(x,z,P,U,N){ let b=m.get(ck(x,z)); if(!b){ b={p:[],u:[],n:[]}; m.set(ck(x,z),b); } b.p.push(...P); b.u.push(...U); b.n.push(...N); }}; }
  // 一塊豎立四邊形：由 A 到 B（水平），y0→y1，uv 由 [u0,v0]→[u1,v1]
  function quad(qb,A,B,y0,y1,u0,v0,u1,v1,nx,nz){ qb.add((A[0]+B[0])/2,(A[1]+B[1])/2,
    [A[0],y0,A[1], B[0],y0,B[1], B[0],y1,B[1], A[0],y0,A[1], B[0],y1,B[1], A[0],y1,A[1]],
    [u0,v0, u1,v0, u1,v1, u0,v0, u1,v1, u0,v1], [nx,0,nz,nx,0,nz,nx,0,nz,nx,0,nz,nx,0,nz,nx,0,nz]); }
  const off=(x,z)=>ELEV(x,z,12)>0.2;
  // 沿住同一條路（跨幾段）每隔一段距離做一次：馬路係一段段短線，所以要將距離帶落下一段
  const CARRY=new Map(); function every(key,L,sp,fn){ let s=CARRY.has(key)?CARRY.get(key):sp*drnd(); for(;s<L;s+=sp*(0.7+0.6*drnd())) fn(s); CARRY.set(key,s-L); }
  const nearRoad=(x,z)=>cellAt(x,z)&1;

  /* ===== 1. 巴士站（大路，行人路上） ===== */
  const STOPS=[]; const lampNear=(x,z,r)=>props.lamp.some(([lx,lz])=>Math.abs(lx-x)<r&&Math.abs(lz-z)<r);
  MAP.roads.forEach((r,ri)=>{ if(r.bridge||r.elev||r.t==='street') return; const [a,b]=r.n, A=NODES[a], B=NODES[b]; const [ux,uz,L]=dirn(A,B); const side=ri%2?1:-1, nx=uz*side, nz=-ux*side;
    every('bus'+r.name+side,L,G2?200:260,s=>{ if(s<(DEG[a]>=3?NW[a]+10:3)||s>L-(DEG[b]>=3?NW[b]+10:3)) return; const o=r.w/2+2.4, x=A[0]+ux*s+nx*o, z=A[1]+uz*s+nz*o; if(off(x,z)||nearRoad(x+nx*1.4,z+nz*1.4)||nearRoad(x,z)||lampNear(x,z,2.6)) return;
      const yaw=Math.atan2(nx,nz); STOPS.push([x,z,nx,nz,ux,uz]);
      box(x,2.75,z, 4.4,0.16,1.9, yaw,0xc9d1d9); box(x+nx*0.75,1.4,z+nz*0.75, 4.2,2.3,0.06, yaw,0x9fc3d6);   // 頂、背板（玻璃）
      for(const k of [-2,2]) box(x+ux*k+nx*0.8,1.38,z+uz*k+nz*0.8, 0.12,2.76,0.12, yaw,0x6c757d);
      box(x+nx*0.45,0.55,z+nz*0.45, 2.6,0.12,0.45, yaw,0x8d99ae);
      const px=x-nx*0.9+ux*3, pz=z-nz*0.9+uz*3; box(px,1.5,pz,0.1,3,0.1,0,0x6c757d); box(px,3.0,pz,0.7,0.5,0.06,yaw,0xd62828); box(px,2.55,pz,0.7,0.35,0.07,yaw,0xf8f9fa); }); });
  /* ===== 2. 行人路欄杆（灰色鐵欄，路口、斑馬線、車道、巴士站、上落客位留空） ===== */
  const railTex=canvasTex(64,32,(g,w,h)=>{ g.clearRect(0,0,w,h); g.fillStyle='#fff'; for(let x=2;x<w;x+=8) g.fillRect(x,0,4,h); });
  const RCOL=0x9ea7af, PANEL=2.5;
  const gaps=[]; MAP.crossings.forEach(c=>gaps.push([c.p[0],c.p[1],c.half+2.2])); STOPS.forEach(([x,z])=>gaps.push([x,z,4.2]));
  Object.values(LMK).forEach(v=>{ if(v&&v.stop) gaps.push([v.stop[0],v.stop[1],9]); if(v&&v.pos) gaps.push([v.pos[0],v.pos[1],10]); });
  const inGap=(x,z)=>gaps.some(([gx,gz,r])=>(gx-x)*(gx-x)+(gz-z)*(gz-z)<r*r);
  let panels=0; const RAILS=[];
  MAP.roads.forEach(r=>{ if(r.bridge||r.elev) return; const [a,b]=r.n, A=NODES[a], B=NODES[b]; const [ux,uz,L]=dirn(A,B);
    [1,-1].forEach(side=>{ const nx=uz*side, nz=-ux*side, o=r.w/2+0.32; const s0=DEG[a]>=3?NW[a]+3.4:DEG[a]===2?0.2:1, s1=L-(DEG[b]>=3?NW[b]+3.4:DEG[b]===2?0.2:1); let run=0;
      for(let s=s0;s+PANEL<=s1;s+=PANEL){ const sm=s+PANEL/2, x=A[0]+ux*sm+nx*o, z=A[1]+uz*sm+nz*o;
        const drive=nearRoad(x+nx*1.2,z+nz*1.2)||nearRoad(x+nx*2.6,z+nz*2.6)||nearRoad(x+nx*0.7,z+nz*0.7);
        if(drive||inGap(x,z)||off(x,z)||cellAt(x,z)&4||(++run%10===0)){ continue; }
        const P=[A[0]+ux*s+nx*o,A[1]+uz*s+nz*o], Q=[A[0]+ux*(s+PANEL)+nx*o,A[1]+uz*(s+PANEL)+nz*o], yaw=Math.atan2(ux,uz);
        RAILS.push({x,z,P,Q,yaw,nx,nz,k:ck(x,z),dead:false}); panels++; } }); });
  /* ===== 3. 街道設施：消防栓、郵筒、垃圾桶、花槽、沙井蓋 ===== */
  MAP.roads.forEach(r=>{ if(r.bridge||r.elev) return; const [a,b]=r.n, A=NODES[a], B=NODES[b]; const [ux,uz,L]=dirn(A,B);
    [1,-1].forEach(side=>{ const nx=uz*side, nz=-ux*side;
      const at=(s,o)=>[A[0]+ux*s+nx*(r.w/2+o),A[1]+uz*s+nz*(r.w/2+o)], ok=(x,z)=>!off(x,z)&&!nearRoad(x,z)&&!(cellAt(x,z)&(2|4))&&!lampNear(x,z,1.4)&&!inGap(x,z);
      every('hy'+r.name+side,L,70,s=>{ const [x,z]=at(s,0.95); if(!ok(x,z)) return; cyl(x,0.45,z,0.2,0.8,0xf2c230); cyl(x,0.9,z,0.24,0.14,0xd62828); cyl(x,1.02,z,0.13,0.14,0xd62828); box(x,0.6,z,0.56,0.12,0.12,Math.atan2(ux,uz),0xd62828); });   // 消防栓
      every('pb'+r.name+side,L,190,s=>{ const [x,z]=at(s,2.7); if(!ok(x,z)) return; cyl(x,0.65,z,0.32,1.3,0x2d7a3a,1); cyl(x,1.33,z,0.34,0.08,0x23602e,1); box(x-nx*0.3,1.05,z-nz*0.3,0.32,0.06,0.06,Math.atan2(nx,nz),0x111111); });   // 郵筒
      every('bin'+r.name+side,L,G2?45:70,s=>{ const [x,z]=at(s,2.8); if(!ok(x,z)) return; box(x,0.55,z,0.55,1.1,0.55,Math.atan2(ux,uz),drnd()<0.5?0xff8c1a:0x2a9d4a); box(x,1.13,z,0.62,0.08,0.62,Math.atan2(ux,uz),0x333333); });   // 垃圾桶
      if(G2) every('pl'+r.name+side,L,40,s=>{ const [x,z]=at(s,2.85); if(!ok(x,z)) return; const y=Math.atan2(ux,uz); box(x,0.35,z,0.75,0.7,1.8,y,0xbdb5a6); box(x,0.75,z,0.6,0.2,1.65,y,0x4f9d3a); });   // 花槽
      if(side>0) every('mh'+r.name,L,45,s=>{ const lo=r.w/4*(drnd()<0.5?1:-1), x=A[0]+ux*s+uz*lo, z=A[1]+uz*s-ux*lo; if(off(x,z)) return; cyl(x,0.045,z,0.42,0.03,0x3d4148,1); }); }); });   // 沙井蓋
  /* ===== 4. 樓宇門面：雨篷、冷氣機、晾衫竹、天台水缸、霓虹招牌 ===== */
  // 霓虹招牌貼圖集：2048×2048；上面三行係 8×3 個直招牌（256×512），最底一行係 4×2 個橫招牌（512×256）
  const NAMES=['鴻運酒家','金鳳茶樓','大押','東方大藥房','合興金行','祥記粥麵','百樂桌球','明珠珠寶','新華戲院','好運麻雀','龍鳳酒樓','福臨海鮮','永利找換','利源錶行','德記涼茶','發記燒味','九龍賓館','華豐眼鏡','美華影樓','鴻興跌打','大華電器','金城冰室','恆昌當舖','寶華旅館'];
  const HN=['金鳳大酒樓','東方大藥房','百樂桌球會','明珠珠寶金行','合興找換店','福臨海鮮酒家','新華大戲院','鴻運卡拉OK'];
  const NCOL=['#ff2e63','#08f7fe','#ffe700','#39ff14','#ff6b00','#fe53bb','#f5d300','#00e5ff','#ff3131','#b026ff'];
  const BG=['#140a12','#0d1424','#1a0d0d','#101810','#1b1027','#22140a'];
  const cellRect=i=>i<24?[(i%8)*256,Math.floor(i/8)*512,256,512]:[((i-24)%4)*512,1536+Math.floor((i-24)/4)*256,512,256];
  function drawSign(g,i,glow){ const [x,y,w,h]=cellRect(i), vert=i<24, t=vert?NAMES[i]:HN[i-24]; const ca=NCOL[(i*3)%NCOL.length], cb=NCOL[(i*7+4)%NCOL.length];
    if(!glow){ g.fillStyle=BG[i%BG.length]; g.fillRect(x+4,y+4,w-8,h-8); g.fillStyle='#3a3a3a'; g.fillRect(x,y,w,4); g.fillRect(x,y+h-4,w,4); g.fillRect(x,y,4,h); g.fillRect(x+w-4,y,4,h); }
    else { g.fillStyle='#000'; g.fillRect(x,y,w,h); g.save(); g.beginPath(); g.rect(x,y,w,h); g.clip(); const k=1/(1+2*GM); g.translate(x+w/2,y+h/2); g.scale(k,k); g.translate(-(x+w/2),-(y+h/2)); }
    g.save(); g.shadowColor=ca; g.shadowBlur=glow?26:12; g.strokeStyle=ca; g.lineWidth=glow?12:6; rr(g,x+16,y+16,w-32,h-32,18); g.stroke();
    if(i%3===0){ g.lineWidth=glow?8:3; g.strokeStyle=cb; g.shadowColor=cb; rr(g,x+30,y+30,w-60,h-60,12); g.stroke(); }
    if(!glow){ g.shadowBlur=0; g.strokeStyle='rgba(255,255,255,.75)'; g.lineWidth=1.5; rr(g,x+16,y+16,w-32,h-32,18); g.stroke(); g.shadowBlur=12; }
    g.fillStyle=cb; g.shadowColor=cb; g.textAlign='center'; g.textBaseline='middle';
    const ch=[...t];
    if(t==='大押'){ g.font='bold 150px sans-serif'; g.beginPath(); g.arc(x+w/2,y+h*0.62,92,0,6.3); g.lineWidth=glow?14:7; g.strokeStyle=cb; g.stroke(); g.fillText('押',x+w/2,y+h*0.63); g.font='bold 70px sans-serif'; g.fillText('大',x+w/2,y+h*0.2); }   // 當舖：蝠鼠銅錢
    else if(vert){ const n=ch.length, fs=Math.min(120,(h-80)/n*0.92); g.font='bold '+fs+'px sans-serif'; ch.forEach((c,k)=>g.fillText(c,x+w/2,y+h/2+(k-(n-1)/2)*fs*1.05)); if(!glow){ g.shadowBlur=0; g.fillStyle='rgba(255,255,255,.55)'; ch.forEach((c,k)=>g.fillText(c,x+w/2,y+h/2+(k-(n-1)/2)*fs*1.05)); } }
    else { let fs=110; g.font='bold '+fs+'px sans-serif'; while(g.measureText(t).width>w-70&&fs>30){ fs-=4; g.font='bold '+fs+'px sans-serif'; } g.fillText(t,x+w/2,y+h/2+4); if(!glow){ g.shadowBlur=0; g.fillStyle='rgba(255,255,255,.5)'; g.fillText(t,x+w/2,y+h/2+4); } }
    g.restore(); if(glow) g.restore(); }
  const GM=0.14;   // 光暈塊每邊大 14%，光暈貼圖入面嘅內容就縮細返同一比例，對齊招牌
  const atlas=canvasTex(2048,2048,(g)=>{ g.fillStyle='#222'; g.fillRect(0,0,2048,2048); for(let i=0;i<32;i++) drawSign(g,i,false); g.fillStyle='#2f3337'; g.fillRect(2040,2040,8,8); },false);
  const glowT=canvasTex(512,512,(g)=>{ g.scale(0.25,0.25); for(let i=0;i<32;i++) drawSign(g,i,true); },false);
  atlas.anisotropy=8; atlas.generateMipmaps=true;
  const SIGNQ=QB(), GLOWQ=QB(), FSQ=QB(), FGQ=QB();   // 一般招牌、閃爍招牌、落雨地面倒影
  // 倒影：用一條柔和光帶貼圖（中間光、邊位淡出），按招牌字色上色
  const REFB=new Map(); const _rc=new THREE.Color();
  function rquad(C0,C1,C2,C3,y,hex){ const k=ck((C0[0]+C2[0])/2,(C0[1]+C2[1])/2); let b=REFB.get(k); if(!b){ b={p:[],u:[],c:[]}; REFB.set(k,b); } _rc.set(hex);
    b.p.push(C0[0],y,C0[1], C1[0],y,C1[1], C2[0],y,C2[1], C0[0],y,C0[1], C2[0],y,C2[1], C3[0],y,C3[1]); b.u.push(0,0, 1,0, 1,1, 0,0, 1,1, 0,1); for(let q=0;q<6;q++) b.c.push(_rc.r,_rc.g,_rc.b); }
  const refCol=i=>NCOL[(i*7+4)%NCOL.length];
  function gquad(qb,C0,C1,C2,C3,y,u0,v0,u1,v1){ qb.add((C0[0]+C2[0])/2,(C0[1]+C2[1])/2,[C0[0],y,C0[1], C1[0],y,C1[1], C2[0],y,C2[1], C0[0],y,C0[1], C2[0],y,C2[1], C3[0],y,C3[1]],[u0,v1, u1,v1, u1,v0, u0,v1, u1,v0, u0,v0],[0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0]); }
  let nFlick=0; const flick=()=>{ const f=drnd()<0.045; if(f) nFlick++; return f; }; const DK=[2043/2048,1-2043/2048];   // 深色角落（框邊用）
  const UV=(i,flip)=>{ const [x,y,w,h]=cellRect(i); let u0=x/2048,u1=(x+w)/2048; if(flip){ const t=u0; u0=u1; u1=t; } return [u0,1-(y+h)/2048,u1,1-y/2048]; };
  let nSigns=0;
  // 直招牌：垂直於外牆凸出（兩面都讀得正），連鐵架
  function vSign(fx,fz,ox,oz,y0,len,ht,i){ // fx,fz：外牆位置；ox,oz：向街方向
    const P=[fx+ox*0.35,fz+oz*0.35], Q=[fx+ox*(0.35+len),fz+oz*(0.35+len)], tx=-oz, tz=ox; const t=0.12;
    const Pa=[P[0]+tx*t,P[1]+tz*t], Qa=[Q[0]+tx*t,Q[1]+tz*t], Pb=[P[0]-tx*t,P[1]-tz*t], Qb=[Q[0]-tx*t,Q[1]-tz*t];
    const [a0,b0,a1,b1]=UV(i,false), [c0,d0,c1,d1]=UV(i,true); const fl=flick(), SIGNQ_=fl?FSQ:SIGNQ, GLOWQ_=fl?FGQ:GLOWQ;
    // 直招牌貼圖係「直」嘅：旋轉 90°（u 沿高度）唔使，因為 cell 本身係 256×512 豎直，quad 闊 len 高 ht
    quad(SIGNQ_,Qa,Pa,y0,y0+ht,a0,b0,a1,b1,tx,tz); quad(SIGNQ_,Pb,Qb,y0,y0+ht,a0,b0,a1,b1,-tx,-tz);
    quad(SIGNQ,Qb,Qa,y0,y0+ht,DK[0],DK[1],DK[0],DK[1],ox,oz);
    const g=len*GM, gy=ht*GM; const Ga=[Pa[0]+tx*0.02-ox*g,Pa[1]+tz*0.02-oz*g], Gb=[Qa[0]+tx*0.02+ox*g,Qa[1]+tz*0.02+oz*g], Ha=[Pb[0]-tx*0.02-ox*g,Pb[1]-tz*0.02-oz*g], Hb=[Qb[0]-tx*0.02+ox*g,Qb[1]-tz*0.02+oz*g];
    const [e0,f0,e1,f1]=UV(i,false); quad(GLOWQ_,Gb,Ga,y0-gy,y0+ht+gy,e0,f0,e1,f1,tx,tz); quad(GLOWQ_,Ha,Hb,y0-gy,y0+ht+gy,e0,f0,e1,f1,-tx,-tz);
    { const w=0.75, W0=[fx+ox*0.3-tx*w,fz+oz*0.3-tz*w], W1=[fx+ox*0.3+tx*w,fz+oz*0.3+tz*w], e=len+7; rquad(W0,W1,[W1[0]+ox*e,W1[1]+oz*e],[W0[0]+ox*e,W0[1]+oz*e],0.14,refCol(i)); }   // 落雨地面倒影
    const yaw=Math.atan2(ox,oz); for(const yy of [y0+ht-0.3,y0+0.3]) box(fx+ox*0.2,yy,fz+oz*0.2,0.06,0.06,0.5,yaw,0x2b2d33);   // 鐵架
    nSigns++; }
  // 橫招牌：貼住外牆
  function hSign(A,B,ox,oz,y0,ht,i){ const P=[A[0]+ox*0.14,A[1]+oz*0.14], Q=[B[0]+ox*0.14,B[1]+oz*0.14]; const [a0,b0,a1,b1]=UV(i,false); const fl=flick();
    quad(fl?FSQ:SIGNQ,P,Q,y0,y0+ht,a0,b0,a1,b1,ox,oz);
    rquad(P,Q,[Q[0]+ox*6,Q[1]+oz*6],[P[0]+ox*6,P[1]+oz*6],0.14,refCol(i));
    const gx=(Q[0]-P[0])*GM, gz=(Q[1]-P[1])*GM, gy=ht*GM;
    quad(fl?FGQ:GLOWQ,[P[0]-gx+ox*0.03,P[1]-gz+oz*0.03],[Q[0]+gx+ox*0.03,Q[1]+gz+oz*0.03],y0-gy,y0+ht+gy,a0,b0,a1,b1,ox,oz); nSigns++; }
  const vIdx=()=>drnd()*24|0, hIdx=()=>24+(drnd()*8|0);
  DFRONT.forEach(F=>{ const [A,B]=[F.c[0],F.c[1]], D=F.c[3]; const ex=B[0]-A[0], ez=B[1]-A[1], W=Math.hypot(ex,ez); if(W<4) return; const ux=ex/W, uz=ez/W;
    let ox=A[0]-D[0], oz=A[1]-D[1]; const ol=Math.hypot(ox,oz)||1; ox/=ol; oz/=ol;   // 向街
    if(off(A[0],A[1])) return;
    const at=(s,o=0)=>[A[0]+ux*s+ox*o,A[1]+uz*s+oz*o], yaw=Math.atan2(ux,uz);
    // 雨篷（舖頭上面）
    const nU=Math.max(1,Math.round(W/6)), uw=W/nU;
    for(let k=0;k<nU;k++){ if(drnd()<0.25) continue; const [x,z]=at(uw*(k+0.5),0.75); box(x,3.75,z,uw-0.4,0.12,1.5,yaw,dpick([0xd62828,0x2a9d8f,0xf4a261,0x457b9d,0xe9c46a,0x6a4c93,0x2b9348,0xf1faee]),-0.28); }
    // 地舖門口雜物（超精細）
    if(G2) for(let k=0;k<nU;k++){ if(drnd()<0.5) continue; const [x,z]=at(uw*(k+0.3+drnd()*0.4),0.7); if(drnd()<0.5){ for(let q=0;q<3;q++) box(x+ux*q*0.55,0.28+(q%2)*0.3,z+uz*q*0.55,0.5,0.28,0.4,yaw,dpick([0xe63946,0xffb703,0x2a9d8f,0xf77f00])); }
      else { box(x,0.24,z,0.42,0.48,0.42,yaw,dpick([0xd62828,0x1d4ed8,0x16a34a])); } }
    const tall=F.type!=='estate'&&F.h>6&&(!F.pc||F.pc==='orig'||F.pc==='resi');
    // 冷氣機、晾衫竹（唐樓／舊樓上面幾層）
    if(tall){ for(let y=5.8;y<Math.min(F.h-1.5,F.pc==='resi'&&GFX<3?32:1e9);y+=3) for(let s=1.2;s<W-1;s+=2.2){ const q=drnd(); if(q<(G2?0.42:0.26)){ const [x,z]=at(s,0.32); box(x,y,z,0.85,0.55,0.45,yaw,q<0.1?0xcfd4da:0xeef0f2); box(x+ox*0.23,y,z+oz*0.23,0.6,0.38,0.02,yaw,0x9aa1a9); }
        else if(G2&&q>0.9){ const [x,z]=at(s,0.2), py=Math.atan2(ox,oz); for(const d of [-0.45,0.45]){ const px=x+ux*d, pz=z+uz*d; box(px+ox*0.75,y+0.95,pz+oz*0.75,0.05,0.05,1.5,py,0x9c7a4f);   // 晾衫竹：由窗口伸出
            for(let c=0;c<3;c++){ if(drnd()<0.25) continue; const cx=px+ox*(0.35+c*0.42), cz=pz+oz*(0.35+c*0.42); box(cx,y+0.6,cz,0.03,0.66,0.34,py,dpick([0xffffff,0x4cc9f0,0xf72585,0xffd166,0x90be6d,0x8d99ae,0xe63946])); } } } }
      // 天台水缸、樓梯屋、天線
      const cx=(F.c[0][0]+F.c[2][0])/2, cz=(F.c[0][1]+F.c[2][1])/2;
      if(drnd()<0.75){ cyl(cx+ux*1.5,F.h+0.85,cz+uz*1.5,0.85,1.6,dpick([0xdfe7ee,0x5fa8d3,0xf1f1f1])); box(cx-ux*2,F.h+1.2,cz-uz*2,2.2,2.4,2.4,yaw,0xcfc8bb); }
      if(G2&&drnd()<0.5) box(cx-ux*2,F.h+3.6,cz-uz*2,0.06,2.6,0.06,0,0x555b63); }
    // 霓虹招牌：直招牌喺 5–12 米高（超精細有上下兩層），橫招牌貼外牆
    if(F.type!=='estate'){ const step=G2?3.6:5.2;
      for(let s=1.6;s<W-1.2;s+=step+drnd()*2){ if(drnd()<(G2?0.2:0.4)) continue; const fx=A[0]+ux*s, fz=A[1]+uz*s; const len=1.5+drnd()*1.2, ht=Math.min(F.h-5.2,3.2+drnd()*4); if(ht<2.2) continue;
        vSign(fx,fz,ox,oz,5.0+drnd()*1.2,len,ht,vIdx());
        if(G2&&F.h>15&&drnd()<0.45){ const h2=2.4+drnd()*2.6; if(5+ht+1.4+h2<F.h) vSign(fx+ux*1.2,fz+uz*1.2,ox,oz,5+ht+1.2,len*0.8,h2,vIdx()); } }
      if(F.type==='shops'||G2&&drnd()<0.4){ const s0=W*0.1+drnd()*W*0.2, w=Math.min(W*0.7,4+drnd()*4); hSign(at(s0),at(s0+w),ox,oz,4.95,Math.min(1.6,w*0.32),hIdx()); } }
    else if(drnd()<(G2?0.8:0.5)){ const s0=W*0.2, w=Math.min(W*0.6,10); hSign(at(s0),at(s0+w),ox,oz,3.4,1.25,hIdx()); }   // 屋苑商場平台
  });
  /* ===== 出網格 ===== */
  const VMAT=new THREE.MeshLambertMaterial({vertexColors:true});
  VB.forEach(b=>{ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(b.n,3)); g.setAttribute('color',new THREE.Float32BufferAttribute(b.c,3)); g.computeBoundingSphere();
    const m=new THREE.Mesh(g,VMAT); m.receiveShadow=true; m.matrixAutoUpdate=false; scene.add(m); });
  const qmesh=(qb,mat,ro)=>qb.m.forEach(b=>{ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(b.n,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(b.u,2)); g.computeBoundingSphere();
    const m=new THREE.Mesh(g,mat); m.matrixAutoUpdate=false; if(ro) m.renderOrder=ro; scene.add(m); });
  /* 欄杆：每格兩個網格（鐵枝貼圖＋柱同扶手），可以喺遊戲中途剪開（例如救護車要駛出車道、病人位置） */
  const RIM=new THREE.MeshLambertMaterial({map:railTex,color:RCOL,alphaTest:0.5,side:THREE.DoubleSide}), RCH=new Map();
  RAILS.forEach(p=>{ let c=RCH.get(p.k); if(!c){ c={ps:[],ms:[]}; RCH.set(p.k,c); } c.ps.push(p); });
  function railBuild(k){ const c=RCH.get(k); if(!c) return; c.ms.forEach(m=>{ scene.remove(m); m.geometry.dispose(); }); c.ms.length=0;
    const q=QB(), b={p:[],n:[],c:[]}; c.ps.forEach(p=>{ if(p.dead) return; quad(q,p.P,p.Q,0.32,1.0,0,0,PANEL*1.6,1,p.nx,p.nz);
      putB(b,'box',p.x,1.06,p.z,0.07,0.07,PANEL,p.yaw,RCOL); putB(b,'box',p.x,0.3,p.z,0.05,0.05,PANEL,p.yaw,RCOL); putB(b,'box',p.P[0],0.58,p.P[1],0.09,1.16,0.09,p.yaw,RCOL); putB(b,'box',p.Q[0],0.58,p.Q[1],0.09,1.16,0.09,p.yaw,RCOL); });
    q.m.forEach(v=>{ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(v.p,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(v.n,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(v.u,2)); g.computeBoundingSphere(); const m=new THREE.Mesh(g,RIM); m.matrixAutoUpdate=false; scene.add(m); c.ms.push(m); });
    if(b.p.length){ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(b.n,3)); g.setAttribute('color',new THREE.Float32BufferAttribute(b.c,3)); g.computeBoundingSphere(); const m=new THREE.Mesh(g,VMAT); m.receiveShadow=true; m.matrixAutoUpdate=false; scene.add(m); c.ms.push(m); } }
  RCH.forEach((c,k)=>railBuild(k));
  const segD2=(px,pz,A,B)=>{ const dx=B[0]-A[0],dz=B[1]-A[1],L2=dx*dx+dz*dz||1; let t=((px-A[0])*dx+(pz-A[1])*dz)/L2; t=Math.max(0,Math.min(1,t)); const qx=A[0]+dx*t-px,qz=A[1]+dz*t-pz; return qx*qx+qz*qz; };
  const crossP=(a,b,c,d)=>{ const r=[b[0]-a[0],b[1]-a[1]], s=[d[0]-c[0],d[1]-c[1]], den=r[0]*s[1]-r[1]*s[0]; if(Math.abs(den)<1e-9) return null; const t=((c[0]-a[0])*s[1]-(c[1]-a[1])*s[0])/den, u=((c[0]-a[0])*r[1]-(c[1]-a[1])*r[0])/den; return t>=0&&t<=1&&u>=0&&u<=1?[a[0]+r[0]*t,a[1]+r[1]*t]:null; };
  function cut(test){ const ks=new Set(); RAILS.forEach(p=>{ if(!p.dead&&test(p)){ p.dead=true; ks.add(p.k); } }); ks.forEach(railBuild); return ks.size; }
  const RAILAPI={
    cutSeg(A,B,r){ return cut(p=>segD2(p.x,p.z,A,B)<r*r); },   // 一條線兩邊 r 米內嘅欄杆拆走
    cutPath(pts,r=3.5){ const hits=[]; for(let i=1;i<pts.length;i++){ const A=pts[i-1],B=pts[i], x0=Math.min(A[0],B[0])-3,x1=Math.max(A[0],B[0])+3,z0=Math.min(A[1],B[1])-3,z1=Math.max(A[1],B[1])+3;
        RAILS.forEach(p=>{ if(p.dead||p.x<x0||p.x>x1||p.z<z0||p.z>z1) return; const h=crossP(A,B,p.P,p.Q); if(h) hits.push(h); }); }
      return hits.length?cut(p=>hits.some(h=>(p.x-h[0])**2+(p.z-h[1])**2<r*r)):0; },   // 路線穿過欄杆嘅位：前後各 r 米拆走
    cutPts(list,r){ return cut(p=>list.some(q=>(p.x-q[0])**2+(p.z-q[1])**2<r*r)); },
    blockedSeg(A,B){ for(const p of RAILS){ if(!p.dead&&crossP(A,B,p.P,p.Q)) return true; } return false; },
    hits(pts){ let n=0; for(let i=1;i<pts.length;i++) for(const p of RAILS) if(!p.dead&&crossP(pts[i-1],pts[i],p.P,p.Q)) n++; return n; } };
  window.__RAIL=RAILAPI;
  // 救護站、醫院同其他地標：由車位／停車點拉一條線去最近嘅馬路，兩邊留空
  const nearRoadPt=(x,z)=>{ let best=null,bd=1e9; MAP.roads.forEach(r=>{ if(r.elev) return; const A=NODES[r.n[0]],B=NODES[r.n[1]]; const dx=B[0]-A[0],dz=B[1]-A[1],L2=dx*dx+dz*dz||1; let t=((x-A[0])*dx+(z-A[1])*dz)/L2; t=Math.max(0,Math.min(1,t)); const px=A[0]+dx*t,pz=A[1]+dz*t, d=(px-x)**2+(pz-z)**2; if(d<bd){ bd=d; best=[px,pz]; } }); return best; };
  Object.values(LMK).forEach(v=>{ if(!v||Array.isArray(v)) return; if(v.pos){ const q=nearRoadPt(v.pos[0],v.pos[1]); if(q) RAILAPI.cutSeg(v.pos,q,6); }
    if(v.stop&&v.patient){ RAILAPI.cutSeg(v.stop,v.patient,2.5); RAILAPI.cutPath([v.stop,v.patient],3); } if(v.stop&&v.door){ RAILAPI.cutSeg(v.stop,v.door,3); RAILAPI.cutPath([v.stop,v.door],3); } });
  const SMAT=new THREE.MeshBasicMaterial({map:atlas,color:0xbdbdbd});
  const GMAT=new THREE.MeshBasicMaterial({map:glowT,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0,side:THREE.DoubleSide});
  qmesh(SIGNQ,SMAT); qmesh(GLOWQ,GMAT,2);
  // 閃爍招牌（舊光管接觸唔良）：兩組，各自一個材質
  const FS=[SMAT.clone(),SMAT.clone()], FG=[GMAT.clone(),GMAT.clone()]; let fk=0;
  [[FSQ,FS],[FGQ,FG]].forEach(([q,ms],gi)=>q.m.forEach(b=>{ const k=fk++%2; const one=QB(); one.m.set('x',b); qmesh(one,ms[k],gi?2:0); }));
  const RMAT=new THREE.MeshBasicMaterial({map:glowT,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0,polygonOffset:true,polygonOffsetFactor:-2}); RMAT.visible=false;
  RMAT.map=canvasTex(64,128,(g,w,h)=>{ const gx=g.createLinearGradient(0,0,w,0); gx.addColorStop(0,'rgba(255,255,255,0)'); gx.addColorStop(0.5,'rgba(255,255,255,1)'); gx.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=gx; g.fillRect(0,0,w,h);
    g.globalCompositeOperation='destination-in'; const gy=g.createLinearGradient(0,0,0,h); gy.addColorStop(0,'rgba(0,0,0,0)'); gy.addColorStop(0.75,'rgba(0,0,0,.8)'); gy.addColorStop(1,'rgba(0,0,0,1)'); g.fillStyle=gy; g.fillRect(0,0,w,h);
    g.globalCompositeOperation='source-over'; g.fillStyle='rgba(0,0,0,.35)'; for(let y=0;y<h;y+=5) g.fillRect(0,y,w,2); },false);   // 橫向水紋
  RMAT.vertexColors=true; RMAT.needsUpdate=true;
  REFB.forEach(b=>{ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(b.u,2)); g.setAttribute('color',new THREE.Float32BufferAttribute(b.c,3)); g.computeBoundingSphere(); const m=new THREE.Mesh(g,RMAT); m.matrixAutoUpdate=false; m.renderOrder=1; scene.add(m); });
  /* ===== 電腦畫質（GFX 3）加細節：路面、外牆、街道設施 ===== */
  if(GFX>=3){
    let pd=99991; const pr=()=>{ pd=(pd*48271)%2147483647; return pd/2147483647; }; const pp=a=>a[pr()*a.length|0];
    const PV=new Map(); const pbox=(x,y,z,sx,sy,sz,yaw,hex,pitch=0,roll=0)=>{ const k=ck(x,z); let b=PV.get(k); if(!b){ b={p:[],n:[],c:[]}; PV.set(k,b); } putB(b,'box',x,y,z,sx,sy,sz,yaw,hex,pitch,roll); };
    TPL.cone=new THREE.ConeGeometry(1,1,10).toNonIndexed();
    const pcone=(x,y,z,r,h,hex)=>{ const k=ck(x,z); let b=PV.get(k); if(!b){ b={p:[],n:[],c:[]}; PV.set(k,b); } putB(b,'cone',x,y,z,r,h,r,0,hex); };
    const pcyl=(x,y,z,r,h,hex)=>{ const k=ck(x,z); let b=PV.get(k); if(!b){ b={p:[],n:[],c:[]}; PV.set(k,b); } putB(b,'cyl',x,y,z,r,h,r,0,hex); };
    const ANI=8, FONT='"PingFang HK","Noto Sans TC","Microsoft JhengHei",sans-serif';
    const tex=(w,h,fn)=>{ const t=canvasTex(w,h,fn,false); t.anisotropy=ANI; return t; };
    // 地面四邊形：中心 (x,z)，闊 w、長 l（順 fx,fz），貼圖格 cell（cols×rows）
    function gq(qb,x,z,w,l,fx,fz,y,cell,cols,rows){ const rx=-fz, rz=fx, hw=w/2, hl=l/2; const P=(a,c)=>[x+rx*a+fx*c,y,z+rz*a+fz*c];
      const u0=(cell%cols)/cols, u1=u0+1/cols, v1=1-Math.floor(cell/cols)/rows, v0=v1-1/rows;
      const a=P(-hw,-hl), b=P(hw,-hl), c=P(hw,hl), d=P(-hw,hl); qb.add(x,z,[...a,...b,...c,...a,...c,...d],[u0,v0,u1,v0,u1,v1,u0,v0,u1,v1,u0,v1],[0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0]); }
    /* --- 1. 路面貼圖集：4×2 格（補丁、裂紋、油漬、直箭嘴、左轉、右轉、望右、導盲磚） --- */
    const RD=tex(1024,512,(g,W,H)=>{ g.clearRect(0,0,W,H); const C=(i,fn)=>{ g.save(); g.translate((i%4)*256,Math.floor(i/4)*256); g.beginPath(); g.rect(0,0,256,256); g.clip(); fn(g); g.restore(); };
      C(0,g=>{ g.fillStyle='rgba(38,40,44,.85)'; g.fillRect(20,30,216,196); for(let i=0;i<500;i++){ const v=50+Math.random()*40|0; g.fillStyle='rgba('+v+','+v+','+(v+3)+',.5)'; g.fillRect(20+Math.random()*214,30+Math.random()*194,2,2); } g.strokeStyle='rgba(20,20,22,.9)'; g.lineWidth=4; g.strokeRect(20,30,216,196); });
      C(1,g=>{ g.strokeStyle='rgba(25,26,30,.8)'; g.lineWidth=2.5; for(let k=0;k<5;k++){ let x=128+Math.random()*40-20, y=10; g.beginPath(); g.moveTo(x,y); while(y<246){ x+=Math.random()*30-15; y+=10+Math.random()*16; g.lineTo(x,y); } g.stroke(); } });
      C(2,g=>{ const rg=g.createRadialGradient(128,128,4,128,128,110); rg.addColorStop(0,'rgba(10,10,14,.75)'); rg.addColorStop(0.6,'rgba(20,20,26,.35)'); rg.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=rg; g.beginPath(); g.ellipse(128,128,110,70,0.4,0,7); g.fill(); });
      const arrow=(g,turn)=>{ g.fillStyle='rgba(255,255,255,.93)'; g.beginPath(); g.moveTo(116,250); g.lineTo(140,250); g.lineTo(140,120); if(turn){ g.lineTo(140+0,120); } g.lineTo(166,120); g.lineTo(128,30); g.lineTo(90,120); g.lineTo(116,120); g.closePath(); g.fill();
        if(turn){ const s=turn; g.beginPath(); g.moveTo(128,180); g.lineTo(128+s*70,130); g.lineTo(128+s*70,110); g.lineTo(128+s*110,150); g.lineTo(128+s*70,190); g.lineTo(128+s*70,170); g.lineTo(128,205); g.closePath(); g.fill(); } };
      C(3,g=>arrow(g,0)); C(4,g=>arrow(g,-1)); C(5,g=>arrow(g,1));
      C(6,g=>{ g.fillStyle='rgba(255,255,255,.93)'; g.textAlign='center'; g.textBaseline='middle'; g.font='900 92px '+FONT; g.fillText('望右',128,82); g.font='900 50px Arial'; g.fillText('LOOK RIGHT',128,190,240); });
      C(7,g=>{ g.fillStyle='#e8b800'; g.fillRect(0,0,256,256); g.fillStyle='#c79c00'; for(let y=16;y<256;y+=32) for(let x=16;x<256;x+=32){ g.beginPath(); g.arc(x,y,9,0,7); g.fill(); } g.fillStyle='rgba(255,240,150,.5)'; for(let y=14;y<256;y+=32) for(let x=14;x<256;x+=32){ g.beginPath(); g.arc(x,y,4,0,7); g.fill(); } }); });
    const RDM=new THREE.MeshStandardMaterial({map:RD,transparent:true,depthWrite:false,roughness:0.85,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
    const GQ=QB(); let nDecal=0;
    MAP.roads.forEach(r=>{ if(r.bridge||r.elev) return; const [a,b]=r.n, A=NODES[a], B=NODES[b]; const [ux,uz,L]=dirn(A,B); const nx=uz, nz=-ux;
      const s0=DEG[a]>=3?NW[a]+4:2, s1=L-(DEG[b]>=3?NW[b]+4:2); if(s1-s0<6) return;
      const onRoad=(x,z)=>(cellAt(x,z)&1)&&ELEV(x,z,4)<0.05;
      for(let s=s0+pr()*20;s<s1-3;s+=14+pr()*26){ const lo=(pr()-0.5)*(r.w-3), x=A[0]+ux*s+nx*lo, z=A[1]+uz*s+nz*lo; if(!onRoad(x,z)) continue;
        const c=pr(); if(c<0.4) gq(GQ,x,z,1.6+pr()*2.5,2+pr()*4,ux,uz,0.155,0,4,2); else if(c<0.75) gq(GQ,x,z,1.5+pr()*1.5,3+pr()*3,ux,uz,0.156,1,4,2); else gq(GQ,x,z,1.2+pr(),1.6+pr()*1.5,pr()-0.5,1,0.157,2,4,2); nDecal++; }
      // 路口前行車箭嘴（左上右落：行車線喺 (uz,-ux) 一邊）
      if(r.w>=10) [[b,1],[a,-1]].forEach(([k,sg])=>{ if(DEG[k]<3||!SIGNAL[k]) return; const fx=ux*sg, fz=uz*sg, d=CLR[k]+9; const s=sg>0?L-d:d; if(s<s0+2||s>s1-2) return;
        const lanes=r.w>=14?2:1; for(let q=0;q<lanes;q++){ const lo=(lanes===2?(q?r.w*0.36:r.w*0.14):r.w/4)*sg, x=A[0]+ux*s+nx*lo, z=A[1]+uz*s+nz*lo; if(!onRoad(x,z)) continue;
          gq(GQ,x,z,1.5,5.2,fx,fz,0.175,lanes===2?(q?5:4):pp([3,4,5]),4,2); nDecal++; } }); });
    MAP.crossings.forEach(c=>{ const N=NODES[c.node]; if(!N) return; let dx=N[0]-c.p[0], dz=N[1]-c.p[1]; const L=Math.hypot(dx,dz)||1; dx/=L; dz/=L; const hw=c.half-2.6;
      for(const sd of [-1,1]){ const nx=c.n[0]*sd, nz=c.n[1]*sd;
        const tx=c.p[0]-dx*3.1+nx*(hw-1.2), tz=c.p[1]-dz*3.1+nz*(hw-1.2); if((cellAt(tx,tz)&1)&&ELEV(tx,tz,4)<0.05) gq(GQ,tx,tz,2.6,1.3,-nx,-nz,0.176,6,4,2);   // 望右（企喺路邊嘅人睇得正）
        const kx=c.p[0]+nx*(hw+0.75), kz=c.p[1]+nz*(hw+0.75); if(ELEV(kx,kz,4)<0.05&&!(cellAt(kx,kz)&2)) gq(GQ,kx,kz,3.2,0.9,dx,dz,0.115,7,4,2); } });   // 導盲磚
    /* --- 2. 外牆：水喉、竹棚＋防塵網、鐵閘、舖頭內透光、露台 --- */
    const SH=tex(1024,512,(g,W,H)=>{ const C=(i,fn)=>{ g.save(); g.translate((i%4)*256,Math.floor(i/4)*256); g.beginPath(); g.rect(0,0,256,256); g.clip(); fn(g); g.restore(); };
      const shutter=(g,graf)=>{ g.fillStyle='#9aa0a6'; g.fillRect(0,0,256,256); for(let y=0;y<256;y+=8){ g.fillStyle='#b9bec3'; g.fillRect(0,y,256,3); g.fillStyle='#7d838a'; g.fillRect(0,y+5,256,2); }
        g.fillStyle='#5f656c'; g.fillRect(0,0,10,256); g.fillRect(246,0,10,256); g.fillStyle='#555'; g.fillRect(110,232,36,10);
        if(graf){ g.lineWidth=7; g.lineCap='round'; ['#e63946','#118ab2','#06d6a0','#111'].forEach((c,k)=>{ g.strokeStyle=c; g.beginPath(); let x=30+k*40, y=120+Math.random()*40; g.moveTo(x,y); for(let j=0;j<6;j++){ x+=12+Math.random()*16; y+=Math.random()*40-20; g.lineTo(x,y); } g.stroke(); }); } };
      C(0,g=>shutter(g,false)); C(1,g=>shutter(g,true));
      const inside=(g,bg,items)=>{ g.fillStyle=bg; g.fillRect(0,0,256,256); g.fillStyle='rgba(255,255,255,.35)'; g.fillRect(0,0,256,18);
        for(let y=40;y<230;y+=48){ g.fillStyle='rgba(60,40,30,.55)'; g.fillRect(10,y+34,236,6); for(let x=14;x<240;x+=14+Math.random()*10){ g.fillStyle=pp(items); g.fillRect(x,y+6+Math.random()*12,9+Math.random()*6,28-Math.random()*10); } }
        g.fillStyle='rgba(30,30,30,.45)'; g.fillRect(150,120,30,110); g.beginPath(); g.arc(165,110,14,0,7); g.fill();
        g.strokeStyle='rgba(200,220,230,.6)'; g.lineWidth=5; g.strokeRect(2,2,252,252); g.beginPath(); g.moveTo(128,0); g.lineTo(128,256); g.stroke(); };
      C(2,g=>inside(g,'#f3d9a6',['#d62828','#f77f00','#fcbf49','#eae2b7','#8d5524']));
      C(3,g=>inside(g,'#e9f5f7',['#0077b6','#00b4d8','#90e0ef','#e63946','#ffffff','#52b788']));
      C(4,g=>inside(g,'#f6e7e7',['#6a4c93','#1982c4','#8ac926','#ff595e','#ffca3a','#222']));
      C(5,g=>inside(g,'#fff7d6',['#ef476f','#ffd166','#06d6a0','#118ab2','#073b4c']));
      const poster=(g,a,b,bg,fg)=>{ const gr=g.createLinearGradient(0,0,0,256); gr.addColorStop(0,bg); gr.addColorStop(1,'#111'); g.fillStyle=gr; g.fillRect(0,0,256,256); g.fillStyle=fg; g.textAlign='center'; g.textBaseline='middle';
        g.font='900 52px '+FONT; g.fillText(a,128,90,230); g.font='700 26px '+FONT; g.fillStyle='#fff'; g.fillText(b,128,170,230); g.strokeStyle=fg; g.lineWidth=6; g.strokeRect(8,8,240,240); };
      C(6,g=>poster(g,'星河電訊','5G 無限數據','#162a6b','#5ee7ff')); C(7,g=>poster(g,'綠洲飲品','清涼一夏','#0d4d36','#a7ffb0')); });
    const SHE=tex(1024,512,(g,W,H)=>{ g.fillStyle='#000'; g.fillRect(0,0,W,H); const C=(i,c)=>{ const gr=g.createLinearGradient(0,Math.floor(i/4)*256,0,Math.floor(i/4)*256+256); gr.addColorStop(0,c); gr.addColorStop(1,'#3a2a10'); g.fillStyle=gr; g.fillRect((i%4)*256+4,Math.floor(i/4)*256+4,248,248); };
      C(2,'#ffd9a0'); C(3,'#e8fbff'); C(4,'#ffe6e6'); C(5,'#fff4c8'); C(6,'#cfe8ff'); C(7,'#d8ffe0'); });
    const SHM=new THREE.MeshStandardMaterial({map:SH,emissiveMap:SHE,emissive:0xffffff,emissiveIntensity:0.12,roughness:0.6,side:THREE.DoubleSide}); SHM.userData.pc={shop:true}; if(PCB) PCB.ALL.push(SHM);
    const SQ=QB(), NQ=QB();
    const netT=tex(128,128,(g,W,H)=>{ g.clearRect(0,0,W,H); g.fillStyle='rgba(40,140,70,.8)'; g.fillRect(0,0,W,H); g.globalCompositeOperation='destination-out'; for(let y=2;y<H;y+=6) for(let x=2;x<W;x+=6) g.fillRect(x,y,3,3); g.globalCompositeOperation='source-over'; g.fillStyle='rgba(20,90,45,.9)'; g.fillRect(0,0,W,3); g.fillRect(0,0,3,H); });
    netT.wrapS=netT.wrapT=THREE.RepeatWrapping;
    const NETM=new THREE.MeshLambertMaterial({map:netT,transparent:true,side:THREE.DoubleSide,depthWrite:false});
    let nScaf=0, nPipe=0, nShop=0;
    DFRONT.forEach(F=>{ const [A,B]=[F.c[0],F.c[1]], D=F.c[3]; const ex=B[0]-A[0], ez=B[1]-A[1], W=Math.hypot(ex,ez); if(W<6||off(A[0],A[1])) return; const ux=ex/W, uz=ez/W;
      let ox=A[0]-D[0], oz=A[1]-D[1]; const ol=Math.hypot(ox,oz)||1; ox/=ol; oz/=ol; const at=(s,o=0)=>[A[0]+ux*s+ox*o,A[1]+uz*s+oz*o], yaw=Math.atan2(ux,uz);
      const kind=F.pc||'orig', oldish=F.type!=='estate'&&(kind==='orig'||kind==='resi'||kind==='industrial');
      // 地舖：鐵閘（關咗／半落）、舖頭內透光（夜晚著燈）
      if(F.type!=='estate'||kind==='orig'){ const nU=Math.max(1,Math.round(W/5)), uw=W/nU;
        for(let k=0;k<nU;k++){ const q=pr(); if(q>0.55) continue; const s0=uw*k+0.25, s1=uw*(k+1)-0.25, P=at(s0,0.09), Q=at(s1,0.09);
          const cell=q<0.14?(pr()<0.5?0:1):2+(pr()*4|0); const u0=(cell%4)/4, u1=u0+0.25, vt=1-Math.floor(cell/4)/2, vb=vt-0.5;
          const top=cell<2&&pr()<0.5?3.1:3.1, bot=cell<2&&pr()<0.4?1.9:0.32;
          quad(SQ,P,Q,bot,top,u0,cell<2?vb+(vt-vb)*(bot-0.32)/2.78:vb,u1,vt,ox,oz); nShop++; } }
      // 水喉：外牆直落（舊樓、住宅、工廈）
      if(oldish&&F.h>8){ const n=1+(pr()*2|0); for(let k=0;k<n;k++){ const s=W*(0.15+pr()*0.7), [x,z]=at(s,0.16); pbox(x,(4.9+F.h)/2,z,0.16,F.h-4.9,0.16,yaw,pp([0x8a9096,0x6f767d,0xb8b2a6]));
          for(let y=8;y<F.h-1;y+=3*(2+(pr()*3|0))){ const [x2,z2]=at(s+0.35,0.12); pbox(x2,y,z2,0.7,0.1,0.1,yaw,0x6f767d); } nPipe++; } }
      // 竹棚＋綠色防塵網（裝修中）
      if(oldish&&F.h>12&&pr()<0.09){ const w0=W*(pr()<0.5?0:0.25), w1=Math.min(W,w0+W*(0.5+pr()*0.5)), y0=4.9, y1=Math.min(F.h+1.2,y0+12+pr()*30), o=0.95;
        for(let s=w0;s<=w1+0.01;s+=1.8){ const [x,z]=at(Math.min(s,w1),o); pbox(x,(y0+y1)/2,z,0.08,y1-y0,0.08,yaw,0xc9a86a); }
        for(let y=y0+0.5;y<y1;y+=2){ const [x,z]=at((w0+w1)/2,o+0.06); pbox(x,y,z,w1-w0,0.07,0.07,yaw,0xbf9c5e); }
        for(let y=y0+1;y<y1;y+=4){ const [x,z]=at((w0+w1)/2,o*0.5); pbox(x,y,z,w1-w0,0.06,o,yaw,0xa88a50); }
        quad(NQ,at(w0,o+0.15),at(w1,o+0.15),y0+0.3,y1,0,0,(w1-w0)/1.2,(y1-y0-0.3)/1.2,ox,oz); nScaf++; }
      // 住宅高樓：露台、冷氣機
      if(kind==='resi'&&F.h>20){ for(let y=10;y<F.h-4;y+=3){ if(pr()<0.35){ const s=W*(0.1+pr()*0.5), w=Math.min(W*0.35,2.6), [x,z]=at(s+w/2,0.45); pbox(x,y,z,w,0.14,0.9,yaw,0xe9e6df); const [x2,z2]=at(s+w/2,0.88); pbox(x2,y+0.55,z2,w,1.0,0.05,yaw,0x9fb8c8); }
          if(pr()<0.3){ const [x,z]=at(W*(0.2+pr()*0.6),0.3); pbox(x,y+0.4,z,0.85,0.55,0.45,yaw,0xeef0f2); } } } });
    /* --- 3. 街道設施：綠色路牌龍門架、行人天橋、巴士站燈箱、報攤、電話亭、雪糕筒 --- */
    const PLACES=REGION!=='tm'?[['沙田市中心','Sha Tin Centre'],['大圍','Tai Wai'],['馬鞍山','Ma On Shan'],['九龍','Kowloon'],['火炭','Fo Tan'],['大埔','Tai Po']]:[['屯門市中心','Tuen Mun Centre'],['元朗','Yuen Long'],['屯門碼頭','Tuen Mun Ferry Pier'],['九龍','Kowloon'],['天水圍','Tin Shui Wai'],['青山公路','Castle Peak Road']];
    const GS=tex(1024,512,(g)=>{ for(let i=0;i<4;i++){ const x=(i%2)*512, y=Math.floor(i/2)*256; g.fillStyle='#1b7a3e'; g.fillRect(x,y,512,256); g.strokeStyle='#fff'; g.lineWidth=6; g.strokeRect(x+10,y+10,492,236);
        const a=PLACES[(i*2)%PLACES.length], b=PLACES[(i*2+1)%PLACES.length]; g.fillStyle='#fff'; g.textBaseline='middle';
        [[a,-1],[b,1]].forEach(([p,d],k)=>{ const yy=y+70+k*110; g.textAlign='left'; g.font='900 50px '+FONT; g.fillText(p[0],x+110,yy-14,300); g.font='700 26px Arial'; g.fillText(p[1],x+110,yy+28,300);
          g.save(); g.translate(x+60,yy); g.rotate(k?(i%2?Math.PI/2:-Math.PI/2):0); g.beginPath(); g.moveTo(0,-34); g.lineTo(26,0); g.lineTo(10,0); g.lineTo(10,30); g.lineTo(-10,30); g.lineTo(-10,0); g.lineTo(-26,0); g.closePath(); g.fill(); g.restore(); }); } });
    const GSM=new THREE.MeshStandardMaterial({map:GS,emissiveMap:GS,emissive:0xffffff,emissiveIntensity:0.06,roughness:0.5,side:THREE.DoubleSide}); GSM.userData.pc={ad:true,lo:true}; if(PCB) PCB.ALL.push(GSM);
    const GSQ=QB(), BRG=[], GAN=[]; let nGantry=0, nBridge=0, nKiosk=0;
    const sideOk=(x,z)=>!off(x,z)&&!nearRoad(x,z)&&!(cellAt(x,z)&(2|4))&&!lampNear(x,z,2.2)&&!inGap(x,z);
    MAP.roads.forEach((r,ri)=>{ if(r.bridge||r.elev||r.t==='street'||r.w<11) return; const [a,b]=r.n, A=NODES[a], B=NODES[b]; const [ux,uz,L]=dirn(A,B); const nx=uz, nz=-ux, yaw=Math.atan2(ux,uz);
      const lo=DEG[a]>=3?NW[a]+25:0, hi=L-(DEG[b]>=3?NW[b]+25:0);
      every('gan'+r.name,L,220,s=>{ if(s<lo||s>hi) return; const o=r.w/2+0.9, P=[A[0]+ux*s+nx*o,A[1]+uz*s+nz*o], Q=[A[0]+ux*s-nx*o,A[1]+uz*s-nz*o];
        if(!sideOk(...P)||!sideOk(...Q)||off(A[0]+ux*s,A[1]+uz*s)) return;
        for(const p of [P,Q]) pbox(p[0],3.6,p[1],0.35,7.2,0.35,yaw,0x8c949c); pbox(A[0]+ux*s,6.9,A[1]+uz*s,r.w+2,0.45,0.3,yaw,0x8c949c);
        const cell=pr()*4|0, u0=(cell%2)/2, u1=u0+0.5, v1=1-Math.floor(cell/2)/2, v0=v1-0.5;
        // 兩邊各一塊（面向各自嘅車流）
        for(const sd of [1,-1]){ const c=[A[0]+ux*s+nx*(r.w/4)*sd,A[1]+uz*s+nz*(r.w/4)*sd], hw=Math.min(3.6,r.w/4+0.4), off2=0.2*sd;
          const E=[c[0]+nx*hw-ux*off2,c[1]+nz*hw-uz*off2], Fp=[c[0]-nx*hw-ux*off2,c[1]-nz*hw-uz*off2];
          quad(GSQ,sd>0?E:Fp,sd>0?Fp:E,5.3,8.9,u0,v0,u1,v1,-ux*sd,-uz*sd); pbox(c[0]+ux*0.02*sd,7.1,c[1]+uz*0.02*sd,hw*2,3.62,0.3,yaw,0x55606b); }
        GAN.push([A[0]+ux*s,A[1]+uz*s,Math.atan2(ux,uz)]); nGantry++; });
      // 行人天橋（有上蓋、升降機塔）：大路中段，每條路最多一條
      const farJ=(x,z)=>!J3.some(k=>Math.hypot(NODES[k][0]-x,NODES[k][1]-z)<45)&&!BRG.some(([bx,bz])=>Math.hypot(bx-x,bz-z)<350);
      if(L>18&&DEG[a]===2&&DEG[b]===2&&(r.t==='main'||r.t==='avenue')&&pr()<0.35&&nBridge<6&&farJ((A[0]+B[0])/2,(A[1]+B[1])/2)){ const s=L/2, o=r.w/2+2.0, P=[A[0]+ux*s+nx*o,A[1]+uz*s+nz*o], Q=[A[0]+ux*s-nx*o,A[1]+uz*s-nz*o];
        const bOk=(x,z)=>!off(x,z)&&!nearRoad(x,z)&&!(cellAt(x,z)&(2|4))&&!inGap(x,z); if(bOk(...P)&&bOk(...Q)&&bOk(P[0]+ux*1.3,P[1]+uz*1.3)&&bOk(Q[0]-ux*1.3,Q[1]-uz*1.3)&&!off(A[0]+ux*s,A[1]+uz*s)){
          for(const p of [P,Q]){ pbox(p[0],4.7,p[1],2.6,9.4,2.6,yaw,0xd9dde2); pbox(p[0],9.5,p[1],3.2,0.3,3.2,yaw,0x6c7a89); const [gx,gz]=[p[0]-ux*1.32,p[1]-uz*1.32]; pbox(gx,3.4,gz,1.6,5.6,0.06,yaw,0x6fa8c8); }
          const C=[A[0]+ux*s,A[1]+uz*s], span=r.w+4; pbox(C[0],6.4,C[1],span,0.55,3.2,yaw,0xc3c8ce); pbox(C[0],6.1,C[1],span,0.3,2.4,yaw,0x9aa1a9);
          for(const sd of [-1,1]){ const x=C[0]+ux*1.5*sd, z=C[1]+uz*1.5*sd; pbox(x,7.2,z,span,1.1,0.1,yaw,0x8fb3c9); for(let k=-span/2;k<=span/2;k+=2.5) pbox(x+nx*k,8.1,z+nz*k,0.12,2.6,0.12,yaw,0x6c7a89); }
          pbox(C[0],9.45,C[1],span,0.25,3.6,yaw,0x5d6d7e);
          const sg=pp([0,1]); for(const sd of [-1,1]){ const x=C[0]+ux*1.66*sd, z=C[1]+uz*1.66*sd; pbox(x,6.4,z,span*0.6,0.42,0.04,yaw,sg?0x2b6cb0:0x1b7a3e); }
          BRG.push([C[0],C[1]]); nBridge++; } }
      // 報攤、電話亭
      [1,-1].forEach(side=>{ const sx=uz*side, sz=-ux*side, at=(s,o)=>[A[0]+ux*s+sx*(r.w/2+o),A[1]+uz*s+sz*(r.w/2+o)];
        every('ks'+r.name+side,L,230,s=>{ if(s<lo-10||s>hi+10) return; const [x,z]=at(s,2.7); if(!sideOk(x,z)) return; const y2=Math.atan2(sx,sz);
          if(pr()<0.55){ pbox(x,0.9,z,1.8,1.8,1.3,y2,0x2e7d4f); pbox(x,1.95,z,2.2,0.12,1.8,y2,0x1f5e3a); for(let k=0;k<5;k++){ const [mx,mz]=[x-sx*0.68+ux*(k-2)*0.34,z-sz*0.68+uz*(k-2)*0.34]; pbox(mx,1.0+(k%2)*0.32,mz,0.28,0.36,0.04,y2,pp([0xe63946,0xffd166,0x118ab2,0xffffff,0xf72585])); } }
          else { pbox(x,1.15,z,0.95,2.3,0.95,y2,0xb7bec6); pbox(x,1.25,z,0.8,1.6,0.97,y2,0x6fa8c8); pbox(x,2.35,z,1.0,0.18,1.0,y2,0x1e88e5); }
          nKiosk++; });
        every('cn'+r.name+side,L,280,s=>{ const [x,z]=at(s,0.7); if(!sideOk(x,z)) return; for(let k=0;k<3+(pr()*3|0);k++){ const [cx,cz]=at(s+k*1.1,0.65); pcone(cx,0.48,cz,0.22,0.7,0xff6a13); pcyl(cx,0.5,cz,0.165,0.1,0xffffff); pbox(cx,0.14,cz,0.5,0.05,0.5,0,0x222222); } }); }); });
    // 巴士站：背後燈箱廣告
    STOPS.forEach(([x,z,nx,nz,ux,uz])=>{ const cx=x+nx*0.84+ux*2.6, cz=z+nz*0.84+uz*2.6, P=[cx-ux*0.7,cz-uz*0.7], Q=[cx+ux*0.7,cz+uz*0.7];
      pbox(cx,1.35,cz,1.6,2.3,0.22,Math.atan2(nx,nz),0x3d4752); const cell=6+(pr()*2|0), u0=(cell%4)/4, u1=u0+0.25, vt=1-Math.floor(cell/4)/2;
      quad(SQ,Q,P,0.4,2.3,u0,vt-0.5,u1,vt,-nx,-nz); quad(SQ,[P[0]+nx*0.24,P[1]+nz*0.24],[Q[0]+nx*0.24,Q[1]+nz*0.24],0.4,2.3,u0,vt-0.5,u1,vt,nx,nz); });
    /* 出網格 */
    const PVM=new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.7});
    PV.forEach(b=>{ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(b.n,3)); g.setAttribute('color',new THREE.Float32BufferAttribute(b.c,3)); g.computeBoundingSphere();
      const m=new THREE.Mesh(g,PVM); m.castShadow=true; m.receiveShadow=true; m.matrixAutoUpdate=false; scene.add(m); });
    qmesh(GQ,RDM,1); qmesh(SQ,SHM); qmesh(NQ,NETM,1); qmesh(GSQ,GSM);
    window.__PCD={BRG,GAN,STOPS,GSM,GSQ};
    console.log('電腦畫質細節：路面',nDecal,'舖頭',nShop,'水喉',nPipe,'竹棚',nScaf,'路牌',nGantry,'天橋',nBridge,'報攤／電話亭',nKiosk);
  }

  const DC=scene.children.slice(SC0).filter(o=>o.isMesh&&o.geometry).map(m=>{ m.geometry.computeBoundingSphere(); return {m,c:m.geometry.boundingSphere.center.clone(),r:m.geometry.boundingSphere.radius}; });
  let DCT=0; const DLIM=G2?240:200;
  const dcull=(t)=>{ if(t-DCT<0.4) return; DCT=t; const px=cam.position.x, pz=cam.position.z; for(const d of DC){ const dd=Math.hypot(d.c.x-px,d.c.z-pz)-d.r; d.m.visible=dd<DLIM; } };
  /* ===== 路面字樣：巴士站「BUS STOP」、路口前「慢 SLOW」、大路口黃格 ===== */
  const RT=(()=>{ const mk=(w,h,fn)=>{ const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d'); fn(g,w,h); const t=new THREE.CanvasTexture(c); t.anisotropy=8; return t; };
    const txt=(g,s,x,y,sx,sy,font)=>{ g.save(); g.translate(x,y); g.scale(sx,sy); g.font=font; g.textAlign='center'; g.textBaseline='middle'; g.fillText(s,0,0); g.restore(); };
    const tBus=mk(256,1024,(g,w,h)=>{ g.strokeStyle='#ffd23f'; g.lineWidth=12; g.setLineDash([70,40]); g.strokeRect(8,8,w-16,h-16); g.setLineDash([]); g.fillStyle='#ffd23f';
      txt(g,'STOP',w/2,300,1,2.6,'900 70px Arial'); txt(g,'BUS',w/2,690,1,2.6,'900 80px Arial'); });
    const tSlow=mk(256,768,(g,w,h)=>{ g.fillStyle='rgba(255,255,255,.92)'; txt(g,'慢',w/2,230,1.15,2.1,'900 190px sans-serif'); txt(g,'SLOW',w/2,600,1,2.4,'900 74px Arial'); });
    const tBox=mk(256,256,(g,w,h)=>{ g.strokeStyle='#ffd23f'; g.lineWidth=10; g.strokeRect(6,6,w-12,h-12); g.lineWidth=6; g.save(); g.beginPath(); g.rect(6,6,w-12,h-12); g.clip();
      for(let o=-w;o<w*2;o+=36){ g.beginPath(); g.moveTo(o,0); g.lineTo(o+h,h); g.stroke(); g.beginPath(); g.moveTo(o,h); g.lineTo(o+h,0); g.stroke(); } g.restore(); });
    const B={bus:{t:tBus,p:[],u:[]},slow:{t:tSlow,p:[],u:[]},box:{t:tBox,p:[],u:[]}};
    // 中心 (x,z)，闊 w（橫）、長 l（順住行車方向 fx,fz），字頂向前
    const quad=(b,x,z,w,l,fx,fz,y)=>{ const rx=-fz, rz=fx, hw=w/2, hl=l/2; const P=(a,c)=>[x+rx*a+fx*c,y,z+rz*a+fz*c];
      const q=[P(-hw,-hl),P(hw,-hl),P(hw,hl),P(-hw,-hl),P(hw,hl),P(-hw,hl)]; q.forEach(v=>b.p.push(...v)); b.u.push(0,0, 1,0, 1,1, 0,0, 1,1, 0,1); };
    STOPS.forEach(([x,z,nx,nz])=>{ const cx=x-nx*4.4, cz=z-nz*4.4; if(!(cellAt(cx,cz)&1)||ELEV(cx,cz)>0.05) return; quad(B.bus,cx,cz,2.9,11,-nz,nx,0.2); });
    if(false) MAP.crossings.forEach(c=>{ const N=NODES[c.node];   // 「慢」字已按要求刪除 let dx=N[0]-c.p[0], dz=N[1]-c.p[1]; const L=Math.hypot(dx,dz)||1; dx/=L; dz/=L; const hw=c.half-2.6, lo=Math.min(hw*0.5,4.2);
      const cx=c.p[0]-dx*11+dz*lo, cz=c.p[1]-dz*11-dx*lo; if(!(cellAt(cx,cz)&1)||ELEV(cx,cz)>0.05) return; quad(B.slow,cx,cz,2.6,6,dx,dz,0.2); });
    NODES.forEach((N,k)=>{ if(!SIGNAL[k]||DEG[k]<4||ELEV(N[0],N[1])>0.05) return; const e=ADJ[k][0], O=NODES[e[0]]; let fx=O[0]-N[0], fz=O[1]-N[1]; const L=Math.hypot(fx,fz)||1; const sz=NW[k]*1.5; quad(B.box,N[0],N[1],sz,sz,fx/L,fz/L,0.205); });
    Object.values(B).forEach(b=>{ if(!b.p.length) return; const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(b.u,2));
      const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({map:b.t,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3})); m.renderOrder=1; m.frustumCulled=false; scene.add(m); });
    return {n:B.bus.p.length/18+B.slow.p.length/18+B.box.p.length/18}; })();
  /* ===== 街燈光圈（夜晚／落雨） ===== */
  const LAMPP=(()=>{ const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d'); const rg=g.createRadialGradient(64,64,2,64,64,64); rg.addColorStop(0,'rgba(255,226,160,.85)'); rg.addColorStop(0.5,'rgba(255,210,140,.35)'); rg.addColorStop(1,'rgba(255,200,120,0)'); g.fillStyle=rg; g.fillRect(0,0,128,128);
    const mat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});
    const L=props.lamp.filter(([x,z])=>ELEV(x,z)<0.05); const im=new THREE.InstancedMesh(new THREE.PlaneGeometry(11,11),mat,L.length); const o=new THREE.Object3D();
    L.forEach(([x,z,a],i)=>{ o.position.set(x+Math.sin(a||0)*1.6,0.22,z+Math.cos(a||0)*1.6); o.rotation.set(-Math.PI/2,0,0); o.updateMatrix(); im.setMatrixAt(i,o.matrix); });
    im.renderOrder=2; im.visible=false; scene.add(im); return {im,mat}; })();
  let LV=0, WET=false;
  window.__DF=DFRONT; console.log('精細模式：門面',JSON.stringify(DFRONT.reduce((o,f)=>(o[f.type]=(o[f.type]||0)+1,o),{})),'欄杆',panels,'塊、招牌',nSigns,'個、巴士站',STOPS.length,'個、閃爍招牌',nFlick);
  // 日夜：日間霓虹燈管冇咁光；黃昏開少少；夜晚／落雨全開，加光暈
  return { rail:RAILAPI, stops:STOPS, lampp:LAMPP,
    set(T,k){ const lv=T.night?1:k==='dusk'?0.55:0; LV=lv; WET=!!T.wet; SMAT.color.setScalar(lv?1:0.74); GMAT.opacity=lv*(T.wet?0.75:0.9); GMAT.visible=lv>0;
      FS.forEach(m=>m.color.copy(SMAT.color)); FG.forEach(m=>{ m.opacity=GMAT.opacity; m.visible=GMAT.visible; }); RMAT.visible=(WET||T.pc==='night')&&lv>0; RMAT.opacity=(WET?0.7:0.32)*lv; LAMPP.im.visible=!!(T.night||T.wet); LAMPP.mat.opacity=T.night?0.7:0.4; },
    tick(t){ dcull(t); if(!LV) return; [0,1].forEach(k=>{ const p=(t*(k?9.3:7.1)+k*3.7)%23, off=p<0.35||(p>4&&p<4.15)||(p>4.4&&p<4.6)||(k&&p>15&&p<16.2);   // 大部分時間著，間中閃兩閃，偶然熄一陣
        FS[k].color.setScalar(off?0.45:1); FG[k].opacity=off?0.05:GMAT.opacity; }); } };
})();

if(!GFX){ const NEON=['酒家','冰室','藥房','金行','茶樓','涼茶','麵家','眼鏡','押','海鮮'];
  const mats=NEON.map((t,k)=>new THREE.MeshBasicMaterial({map:canvasTex(64,192,(g,w,h)=>{ const col=['#ff3d7f','#3dd6ff','#ffd23f','#7dff6a','#ff8c42'][k%5];
    g.fillStyle='#22252b'; rr(g,2,2,60,188,10); g.fill(); g.strokeStyle=col; g.lineWidth=5; rr(g,6,6,52,180,8); g.stroke();
    g.fillStyle=col; g.font='bold 40px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; const ch=[...t]; ch.forEach((c,q)=>g.fillText(c,32,96+(q-(ch.length-1)/2)*50)); },false)}));
  // 同一款招牌合併做一個網格（標準模式都慳繪製次數）
  const base=new THREE.PlaneGeometry(1.6,4.8).toNonIndexed(), per=mats.map(()=>[]), o=new THREE.Object3D();
  signs.forEach(s=>{ const mi=rnd()*mats.length|0; [1,-1].forEach(k=>{ o.position.set(s.x,s.y,s.z); o.rotation.set(0,s.a+k*Math.PI/2,0); o.updateMatrix(); const g=base.clone().applyMatrix4(o.matrix); per[mi].push(g); }); });
  per.forEach((gs,mi)=>{ if(!gs.length) return; const P=[],U=[]; gs.forEach(g=>{ P.push(...g.attributes.position.array); U.push(...g.attributes.uv.array); g.dispose(); });
    const G=new THREE.BufferGeometry(); G.setAttribute('position',new THREE.Float32BufferAttribute(P,3)); G.setAttribute('uv',new THREE.Float32BufferAttribute(U,2)); G.computeBoundingSphere(); const m=new THREE.Mesh(G,mats[mi]); m.matrixAutoUpdate=false; scene.add(m); }); }
const CLOUDMAT=new THREE.MeshBasicMaterial({color:0xffffff});
{ const cm=CLOUDMAT, cg=new THREE.SphereGeometry(1,10,8);
  for(let k=0;k<16;k++){ const g=new THREE.Group(); g.position.set(BX0+rnd()*(BX1-BX0),75+rnd()*30,BZ0+rnd()*(BZ1-BZ0)); scene.add(g);
    for(let q=0;q<4;q++){ const m=new THREE.Mesh(cg,cm); m.scale.setScalar(5+rnd()*4); m.position.set(q*6-9,rnd()*2,rnd()*4); g.add(m); } } }

/* ---------- 導航 ---------- */
function nearestNode(x,z){ let best=-1,bd=1e18; for(let i=0;i<NODES.length;i++){ if(!ADJ[i].length) continue; const d=(NODES[i][0]-x)**2+(NODES[i][1]-z)**2; if(d<bd){bd=d;best=i;} } return best; }
function route(from,to,ban){
  const n=NODES.length, dist=new Float64Array(n).fill(Infinity), prev=new Int32Array(n).fill(-1); const open=new Set([from]); dist[from]=0;
  while(open.size){ let u=-1,bd=Infinity; open.forEach(v=>{ if(dist[v]<bd){bd=dist[v];u=v;} }); open.delete(u); if(u===to) break;
    for(const [v,w] of ADJ[u]){ if(ban&&ban.some(e=>e.includes(u)&&e.includes(v))) continue; const nd=dist[u]+w; if(nd<dist[v]){dist[v]=nd;prev[v]=u;open.add(v);} } }
  if(!isFinite(dist[to])) return null; const path=[]; for(let u=to;u!==-1;u=prev[u]) path.push(u); path.reverse(); return {path,len:dist[to]}; }

/* ---------- 紅綠燈：每個路口分兩組方向輪流綠燈 ---------- */
const sigOff=NODES.map((n,k)=>((k*7)%9)*2.4);
const CYCLE=22;
const groupOf=(k,ang)=>Math.abs(Math.cos(ang-REF[k]))>0.707?0:1;
function lightState(k,ang,t){ if(!SIGNAL[k]) return 'g'; const ph=((t+sigOff[k])%CYCLE+CYCLE)%CYCLE;
  if(groupOf(k,ang)===0) return ph<8?'g':ph<10.5?'y':'r'; return ph<11?'r':ph<19?'g':ph<21.5?'y':'r'; }
const SIGS=[];
NODES.forEach((N,k)=>{ if(!SIGNAL[k]) return;
  ADJ[k].forEach(([o,,r])=>{ const O=NODES[o]; const [dx,dz]=dirn(O,N); // 車由 O 駛向 N
    const x=N[0]-dx*(CLR[k]+1.8)+dz*(r.w/2+1.3), z=N[1]-dz*(CLR[k]+1.8)-dx*(r.w/2+1.3);
    if(offRoad(x,z,0.6)) SIGS.push({k,ang:Math.atan2(dx,dz),x,z,fx:-dx,fz:-dz,a:Math.atan2(-dx,-dz)}); }); });
instanced(new THREE.CylinderGeometry(0.13,0.13,4.6,6),M(0x2b2d33),SIGS,(o,s)=>o.position.set(s.x,2.6,s.z),false);
instanced(new THREE.BoxGeometry(1.0,2.6,0.6),M(0x2b2d33),SIGS,(o,s)=>{o.position.set(s.x,5.2,s.z);o.rotation.y=s.a;},true);
const lampGeo=new THREE.SphereGeometry(0.36,12,8);
const LAMP=['r','y','g'].map((c,q)=>{ const m=new THREE.InstancedMesh(lampGeo,new THREE.MeshBasicMaterial({color:0xffffff}),SIGS.length); const o=new THREE.Object3D();
  SIGS.forEach((s,n)=>{ o.position.set(s.x+s.fx*0.3,6.0-q*0.8,s.z+s.fz*0.3); o.updateMatrix(); m.setMatrixAt(n,o.matrix); m.setColorAt(n,new THREE.Color(0x333333)); });
  scene.add(m); return m; });
const LCOL={r:new THREE.Color(0xff2a2a),y:new THREE.Color(0xffc21a),g:new THREE.Color(0x22e06a)}, LOFF=new THREE.Color(0x3a3d44);
function updateLights(t){ SIGS.forEach((s,n)=>{ const st=lightState(s.k,s.ang,t); ['r','y','g'].forEach((c,q)=>LAMP[q].setColorAt(n,st===c?LCOL[c]:LOFF)); }); LAMP.forEach(m=>m.instanceColor.needsUpdate=true); }

/* ---------- 輕鐵路線：屯門鄉事會路、元朗大馬路、天秀路 ---------- */
function tramLine(start){ const seq=[start]; let cur=start, prev=-1;
  for(;;){ const nx=ADJ[cur].find(([o,,r])=>r.t==='avenue'&&o!==prev); if(!nx) break; prev=cur; cur=nx[0]; seq.push(cur); }
  const pts=seq.map(k=>NODES[k]); const cum=[0]; for(let i=1;i<pts.length;i++) cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  return {seq,pts,cum,len:cum[cum.length-1]}; }
const TRAM=REGION==='tm'?tramLine(LAY.J.N0):null, TRAM2=REGION==='tm'?tramLine(LAY.J.YW):null, TRAM3=REGION==='tm'?tramLine(LAY.J.TS0):null, TRAMS=REGION==='tm'?[TRAM,TRAM2,TRAM3]:[];   // 沙田冇輕鐵
function tramAt(s,T=TRAM){ s=Math.max(0,Math.min(T.len-0.01,s)); let i=1; while(i<T.cum.length-1&&T.cum[i]<s) i++;
  const A=T.pts[i-1],B=T.pts[i], k=(s-T.cum[i-1])/(T.cum[i]-T.cum[i-1]||1); return {x:A[0]+(B[0]-A[0])*k,z:A[1]+(B[1]-A[1])*k,a:Math.atan2(B[0]-A[0],B[1]-A[1]),i}; }
// 輕鐵站：揀一段直路中間，離所有路口（連斑馬線）至少 22+路口半徑+8 米，唔會阻住橫過嘅馬路
function lrtStop(T){ let best=T.len/2,bs=-1e9; for(let s=24;s<T.len-24;s+=2){ let m=1e9;
    T.seq.forEach((k,i)=>{ if(DEG[k]>=3) m=Math.min(m,Math.abs(T.cum[i]-s)-CLR[k]-8); });
    const a0=tramAt(s-20,T).a, a1=tramAt(s+20,T).a; const bend=Math.abs(Math.sin(a1-a0));
    const score=m-bend*80-Math.abs(s-T.len*0.45)*0.05; if(m>=22&&score>bs){ bs=score; best=s; } } return best; }
if(REGION==='tm'){ TRAM.lrt=LMK.lrt=lrtStop(TRAM); TRAM2.lrt=lrtStop(TRAM2); TRAM3.lrt=lrtStop(TRAM3);
[[TRAM,'輕鐵 屯門站'],[TRAM2,'輕鐵 元朗站'],[TRAM3,'輕鐵 天水圍站']].forEach(([T,nm])=>{ const p=tramAt(T.lrt,T); const g=new THREE.Group(); g.position.set(p.x,0,p.z); g.rotation.y=p.a; scene.add(g);
  add(new THREE.BoxGeometry(3.2,0.9,40),M(0xd5d9de),g,0,0.6,0,false); add(new THREE.BoxGeometry(3.6,0.3,40),M(0xf2a65a),g,0,4.2,0,true);
  [-18,0,18].forEach(o=>add(new THREE.BoxGeometry(0.3,3.4,0.3),M(0x9aa1aa),g,0,2.5,o,false));
  labelPlane(nm,0,4.9,0,Math.PI/2,'#f08c2e',9,g); labelPlane(nm,0,4.9,0,-Math.PI/2,'#f08c2e',9,g);
  for(let s=-20;s<20;s+=2){ const q=tramAt(T.lrt+s+1,T); markRect([q.x,q.z],q.a,3.3,2.1); } });
}
// 架空電線柱
TRAMS.forEach(T=>{ for(let s=8;s<T.len-8;s+=14){ const p=tramAt(s,T); let near=false; T.seq.forEach(k=>{ if(SIGNAL[k]&&Math.hypot(NODES[k][0]-p.x,NODES[k][1]-p.z)<CLR[k]+6) near=true; }); if(near||Math.abs(s-T.lrt)<24) continue;
  const m=add(new THREE.BoxGeometry(0.3,6.5,0.3),M(0x9aa1aa),scene,p.x,3.3,p.z,false); const arm=add(new THREE.BoxGeometry(9,0.15,0.15),M(0x9aa1aa),scene,p.x,6.4,p.z,false); arm.rotation.y=p.a; } });

/* ================= 遊戲玩法 ================= */
const hemi=new THREE.HemisphereLight(0xf4f8ff,0xa8b898,0.62); scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff6e8,0.62); sun.castShadow=true; sun.shadow.mapSize.set(1024,1024); sun.shadow.radius=3;
Object.assign(sun.shadow.camera,{left:-45,right:45,top:45,bottom:-45,far:200}); scene.add(sun,sun.target);

const amb=ambulance(); amb.userData.body.scale.setScalar(0.85);
const crew=stretcherSet(); const patient=lyingPatient();
const KIT=(()=>{ const g=new THREE.Group(); scene.add(g); g.visible=false;   // 現場急救袋＋AED
  add(rbox(0.75,0.4,0.45,0.08),M(0xff6a1a),g,0,0.22,0); add(rbox(0.6,0.06,0.3,0.03),M(0xffffff),g,0,0.44,0,false); add(new THREE.BoxGeometry(0.62,0.05,0.06),M(0x22262c),g,0,0.47,0,false);
  add(rbox(0.38,0.3,0.14,0.05),M(0xffd400),g,0.62,0.17,0.05); add(new THREE.BoxGeometry(0.2,0.12,0.02),M(0x23a44a),g,0.62,0.2,0.13,false); return g; })();
const bystander=person('bystander'); scene.add(bystander);

/* ---------- 個案 ---------- */
const CASES=[
 {id:'plaza',place:'屯門市廣場',poi:'plaza',title:'男子暈倒',call:'屯門市廣場外，一名男子突然暈倒，旁人致電 999。',
  steps:['救護員評估清醒程度、呼吸同脈搏','量血壓、檢查血糖','用車床將病人送上救護車'],
  quiz:[{q:'見到有人暈倒，第一步應該點做？',o:['確認環境安全，拍膊頭大聲叫佢，睇吓有冇反應','即刻餵佢飲水','搖醒佢，扶佢企起身'],why:'先確保自己安全，再檢查反應同呼吸。冇反應就即刻打 999。'},
        {q:'病人有呼吸但冇反應，等救護車期間應該點擺？',o:['擺復原臥式（側臥）','扶佢坐起身','俾佢俯伏瞓'],why:'側臥可以保持氣道暢通，防止嘔吐物阻塞。'}],
  equip:{q:'男子暈倒但有呼吸，救護員要檢查血糖，用什麼裝備？',o:['🩸 血糖機','🦴 夾板','🩹 燒傷敷料','💨 霧化器'],why:'暈倒可能係低血糖引起，用血糖機一驗就知，可以即刻處理。'},
  tips:['見到有人暈倒，即刻打 999','講清楚地點、病人狀況同聯絡電話','病人有呼吸就擺側臥，保持氣道暢通']},
 {id:'park',place:'屯門公園',poi:'park',title:'長者跌倒',call:'屯門公園內，一位婆婆跌倒，話腳好痛企唔起身。',
  steps:['救護員檢查受傷位置同感覺','用夾板固定懷疑骨折嘅腳','小心抬婆婆上車床'],
  quiz:[{q:'婆婆跌倒後話腳好痛、企唔起身，應該點做？',o:['唔好郁佢，陪住佢等救護員','即刻扶佢企起身試吓行','用力搓痛嘅位置'],why:'可能有骨折，亂郁會令傷勢加重。保持佢舒服、保暖，等救護員處理。'},
        {q:'救護員用夾板固定懷疑骨折嘅腳，係為咗？',o:['減少郁動，減輕痛楚同避免傷勢加重','令骨頭即刻癒合','代替止痛藥'],why:'固定傷處可以減少移動時嘅痛楚，避免進一步受傷。'}],
  equip:{q:'婆婆懷疑腳骨折，救護員應該用咩裝備？',o:['🦴 真空夾板','💨 霧化器','🩸 血糖機','🩹 燒傷敷料'],why:'用夾板固定懷疑骨折嘅位置，搬動時會少啲痛，亦避免傷勢加重。'},
  tips:['長者跌倒後唔好急住扶佢企起身','懷疑骨折就唔好隨便移動傷處','陪住長者，等救護員到場']},
 {id:'townhall',place:'屯門大會堂',poi:'townhall',title:'女士胸口痛',call:'屯門大會堂，一位女士胸口翳痛、出冷汗。',
  steps:['救護員問病歷：幾時開始痛、痛去邊','俾氧氣、做心電圖','安排病人半坐臥送院'],
  quiz:[{q:'女士胸口翳痛、出冷汗，最需要擔心係咩？',o:['可能係心臟病發','可能只係肚餓','可能係扭傷'],why:'胸口翳痛加出冷汗係心臟病發嘅警號，要盡快召救護車。'},
        {q:'等救護車期間，應該點樣幫佢？',o:['讓佢坐低或半坐臥休息，唔好走動','叫佢自己行去醫院','叫佢做運動舒緩下'],why:'休息可以減少心臟負擔。如果佢暈低冇反應，就要做心肺復甦。'}],
  equip:{q:'女士胸口痛，救護員要即刻檢查心臟，應該用咩裝備？',o:['💓 DM機（心電圖功能）','🦴 夾板','🩹 燒傷敷料','💨 霧化器'],why:'心電圖可以睇到心臟有冇出問題，資料仲可以預先通知醫院。'},
  tips:['胸口痛、出冷汗可能係心臟病發，即刻打 999','等候時讓病人坐低休息，唔好走動','如果病人暈低冇反應，盡快做心肺復甦']},
 {id:'station',place:'屯門站',poi:'station',title:'少年哮喘發作',call:'屯門站外，一名少年哮喘發作，透唔到氣。',
  steps:['救護員評估呼吸同血含氧量','用霧化器俾藥舒緩氣管','讓病人坐直送院'],
  quiz:[{q:'有人哮喘發作、透唔到氣，等救護車期間應該點做？',o:['讓佢坐直身，協助佢用自己嘅氣管舒張劑（如有）','叫佢平躺瞓低','叫佢跑兩步深呼吸'],why:'坐直有助呼吸；如果佢有醫生處方嘅噴劑，可以協助佢使用。'}],
  equip:{q:'少年哮喘發作，救護員應該用咩裝備幫佢舒緩氣管？',o:['💨 霧化器','🦴 夾板','🩸 血糖機','🩹 燒傷敷料'],why:'霧化器可以將舒緩氣管嘅藥物變成霧氣吸入，令呼吸暢順啲。'},
  tips:['哮喘發作要保持冷靜，讓病人坐直','協助病人使用自己嘅噴劑','情況冇改善或者講唔到嘢，即刻打 999']},
 {id:'market',place:'屯門街市',poi:'market',title:'檔主燙傷',call:'屯門街市，一位檔主俾滾水燙傷手臂。',
  steps:['救護員檢查燒傷範圍同深度','用清水降溫，再用燒傷敷料包紮','安撫病人，送院'],
  quiz:[{q:'俾滾水燙傷，第一時間應該點處理？',o:['用清涼嘅流動水沖洗傷處 10 至 20 分鐘','塗牙膏或者豉油','用冰塊直接敷'],why:'清涼流動水可以降溫止痛；唔好用冰或者偏方，會令傷勢更差。'}],
  equip:{q:'檔主手臂燙傷，救護員降溫之後應該用咩包紮？',o:['🩹 燒傷敷料','🦴 夾板','💓 DM機（心電圖功能）','💨 霧化器'],why:'燒傷敷料可以保護傷口、減少感染同痛楚。'},
  tips:['燙傷即刻用清涼流動水沖 10 至 20 分鐘','除去傷處附近嘅首飾，但唔好撕黐住嘅衫','唔好塗牙膏、豉油或者用冰']},
 {id:'crash',place:'青山公路',poi:'crash',title:'巴士小巴相撞',call:'青山公路一架雙層巴士同一架綠色小巴相撞，有乘客受傷，話頸痛。',
  steps:['救護員確保現場安全，評估傷者清醒程度','用頸套同脊椎板固定頸椎','小心將傷者抬上車床'],
  quiz:[{q:'你目擊交通意外，第一步應該點做？',o:['留意自身安全，喺安全位置打 999，唔好隨便移動傷者','即刻將傷者拉出車外','企喺馬路中間影相'],why:'先保障自己同其他人嘅安全；除非有即時危險（例如起火），唔好移動傷者，以免加重頸椎或脊椎受傷。'}],
  equip:{q:'傷者撞車後頸痛，懷疑頸椎受傷，救護員應該用咩裝備？',o:['🦺 頸套同長脊椎板','💨 霧化器','🩸 血糖機','🩹 燒傷敷料'],why:'頸套同脊椎板可以固定頸椎同脊椎，搬動時減少進一步受傷。'},
  tips:['發生交通意外，先留意自身安全，再打 999','除非有即時危險，唔好移動傷者','講清楚意外地點、涉及車輛同傷者數目']},
 {id:'yltrauma',place:'元朗劇院',poi:'yltheatre',title:'工人高處墮下',call:'元朗劇院外牆翻新，一名男工人由約 9 米高嘅棚架墮下。GCS 14、血壓 118/76、呼吸每分鐘 20。最就近係博愛醫院。',
  steps:['救護員評估氣道、呼吸、清醒程度同生命表徵','用頸套同脊椎板固定','按創傷分流準則決定送邊間醫院'],
  quiz:[{q:'以下邊個情況，符合「創傷分流」要送去創傷中心？',o:['成人由 6 米（20 呎）以上高處墮下','成人由 1 米高樓梯跌落，手腕擦傷','GCS 15、血壓正常、冇特別致傷過程'],why:'資料庫創傷分流準則：成人（≥12 歲）由 6 米以上高處墮下，要送創傷中心；其他準則包括 GCS 3–13、收縮壓 <90、呼吸 <10 或 ≥30 等。'}],
  equip:{q:'工人由高處墮下，懷疑脊椎受傷，救護員應該用咩裝備？',o:['🦺 頸套同脊椎板','💨 霧化器','🩸 血糖機','🩹 燒傷敷料'],why:'高處墮下有機會傷及頸椎同脊椎，要先固定再搬動。'},
  triage:{q:'工人由約 9 米墮下，最就近係博愛醫院（非創傷中心）。應該送邊間？',o:['🏥 屯門醫院（創傷中心）','🏥 博愛醫院（最就近）'],dest:['tmh','poh'],why:'成人由 6 米以上墮下符合創傷分流準則，要送創傷中心；新界西嘅創傷中心係屯門醫院。例外：病人心臟驟停，或者用 BVM 後仍未能有效處理氣道／呼吸，就要送最就近醫院。'},
  tips:['見到有人由高處墮下，唔好隨便郁佢，即刻打 999','講清楚墮下高度同傷者情況','留意自身安全，遠離仍有危險嘅位置']},
 {id:'ylstroke',place:'元朗公園',poi:'ylpark',title:'伯伯懷疑中風',call:'元朗公園，一位 72 歲伯伯 40 分鐘前突然右邊手腳無力、講嘢唔清。血壓 168/92、GCS 15。屬區醫院係博愛醫院。',
  steps:['救護員驗血糖，排除血糖過低','做 FAST-ED 評分','預先通報醫院，按中風分流送院'],
  quiz:[{q:'伯伯單側嘴角下垂（1 分）、一邊手完全抬唔起（2 分）、只講到 1 樣動物（1 分），其餘正常。FAST-ED 總分係？',o:['4 分','2 分','9 分'],why:'F 1 分＋A 2 分＋S 1 分＝4 分。適用：突發單邊無力或語言障礙、4 小時內、18 歲或以上、SBP > 100、GCS ≥ 8，並已排除血糖過低（H\'stix > 4.0）。'}],
  equip:{q:'進行中風評估之前，救護員一定要先排除咩問題？揀啱裝備：',o:['🩸 血糖機','🦴 夾板','🩹 燒傷敷料','💨 霧化器'],why:'血糖過低可以引起類似中風嘅症狀，要先驗血糖（H\'stix > 4.0 mmol/L）先做中風評估。'},
  triage:{q:'FAST-ED 4 分，病發 40 分鐘，屬區係博愛醫院。應該點樣送院？',o:['🏥 通報後分流去屯門醫院','🏥 送屬區博愛醫院'],dest:['tmh','poh'],why:'院前中風通報及分流：博愛醫院屬區嘅病人 FAST-ED ≥ 4 分，分流至屯門醫院，並要預先通報醫院，方便盡快做溶栓治療。'},
  tips:['記住 FAST：面、手、講嘢、時間','發現懷疑中風，記低病發或者最後正常嘅時間，即刻打 999','唔好俾病人飲嘢食嘢，以免哽親']},
 {id:'ylarrest',place:'元朗站',poi:'ylstation',title:'墮下後心臟驟停',call:'元朗站外，一名男子由約 8 米高嘅行人天橋墮下。救護員到場時佢冇反應、冇正常呼吸，心臟驟停。最就近係博愛醫院。',
  steps:['救護員確認心臟驟停，即刻做心肺復甦','貼上自動心臟除顫器電極片，分析心律','繼續心肺復甦，盡快送院'],
  quiz:[{q:'為成人做心肺復甦，胸外按壓應該點做？',o:['每分鐘 100 至 120 下，按深 5 至 6 厘米','每分鐘 60 下，按深 2 厘米就夠','每分鐘 150 下，按完唔使等胸口回彈'],why:'用力、快速按壓胸口中央：每分鐘 100 至 120 下、深 5 至 6 厘米，每次按完讓胸口完全回彈，盡量減少中斷。'}],
  equip:{q:'傷者心臟驟停，救護員最需要即刻用咩裝備？',o:['⚡ 自動心臟除顫器（AED）','🦴 夾板','🩹 燒傷敷料','💨 霧化器'],why:'心臟驟停要盡快做心肺復甦同使用除顫器，越早除顫，存活機會越高。'},
  triage:{q:'傷者由 8 米墮下，本身符合創傷分流準則，但已經心臟驟停。應該送邊間？',o:['🏥 博愛醫院（最就近）','🏥 屯門醫院（創傷中心）'],dest:['poh','tmh'],why:'創傷分流第一步：病人心臟驟停，就要送最就近醫院，唔再按其他準則分流去創傷中心。另一個例外係用 BVM 後仍然未能有效處理氣道或呼吸。'},
  tips:['見到有人冇反應、冇正常呼吸，即刻打 999 並開始心肺復甦','附近有自動心臟除顫器就盡快攞嚟用，跟住機器語音指示','用力、快速按壓胸口中央，每分鐘 100 至 120 下']},
 {id:'tswtrauma',place:'天水圍站',poi:'tswstation',title:'單車手被撞',call:'天水圍站外天瑞路，一名男單車手俾私家車撞倒。佢醒，GCS 14，但面色蒼白、手腳凍，血壓 84/52、脈搏每分鐘 124。最就近係天水圍醫院。',
  steps:['救護員評估氣道、呼吸、循環同清醒程度','止血、保暖，用頸套同脊椎板固定','按創傷分流準則決定送邊間醫院'],
  quiz:[{q:'創傷病人以下邊個生命表徵，符合「創傷分流」要送創傷中心？',o:['收縮壓低過 90 mmHg','收縮壓 128 mmHg、呼吸每分鐘 18','脈搏每分鐘 88'],why:'資料庫創傷分流準則：≥12 歲病人收縮壓 < 90 mmHg（或者毛細管回流多過 2 秒）要送創傷中心；其他準則包括 GCS 3–13、呼吸 < 10 或 ≥ 30、成人由 6 米以上墮下等。'}],
  equip:{q:'單車手俾車撞倒，懷疑頸椎受傷，救護員應該用咩裝備？',o:['🦺 頸套同脊椎板','💨 霧化器','🩸 血糖機','🩹 燒傷敷料'],why:'撞車有機會傷及頸椎同脊椎，要先固定再搬動。'},
  triage:{q:'單車手血壓 84/52，最就近係天水圍醫院（非創傷中心）。應該送邊間？',o:['🏥 屯門醫院（創傷中心）','🏥 天水圍醫院（最就近）'],dest:['tmh','tsh'],why:'收縮壓 < 90 mmHg 符合創傷分流準則，要送創傷中心；新界西嘅創傷中心係屯門醫院。例外：病人心臟驟停，或者用 BVM 後仍未能有效處理氣道／呼吸，就送最就近醫院。'},
  tips:['見到交通意外，先留意自身安全，喺安全位置打 999','唔好隨便移動傷者，除非有即時危險','用乾淨布料按住流血位置，替傷者保暖']},
 {id:'tswstroke',place:'香港濕地公園',poi:'tswwet',title:'遊客懷疑中風',call:'香港濕地公園，一位 66 歲女士 1 個鐘前突然左邊手腳無力、講嘢含糊。血壓 172/96、GCS 15、H\'stix 6.8。屬區醫院係天水圍醫院。',
  steps:['救護員驗血糖，排除血糖過低','做 FAST-ED 評分','預先通報醫院，按中風分流送院'],
  quiz:[{q:'以下邊個情況，唔符合「院前中風通報」條件？',o:['病發或最後正常時間已經超過 4 小時','18 歲或以上','收縮壓 > 100 mmHg 同 GCS ≥ 8'],why:'院前中風通報要病發或最後正常時間喺 4 小時內，18 歲或以上、唔係長期臥床或輪椅使用者、SBP > 100 mmHg 及 GCS ≥ 8，並已排除血糖過低（H\'stix > 4.0）。'}],
  equip:{q:'女士突然一邊手腳無力，做中風評估之前要先排除咩？揀啱裝備：',o:['🩸 血糖機','🦴 夾板','🩹 燒傷敷料','💨 霧化器'],why:'血糖過低可以引起類似中風嘅症狀，要先驗血糖（H\'stix > 4.0 mmol/L）先做中風評估。'},
  triage:{q:'FAST-ED 5 分，病發 1 個鐘，屬區係天水圍醫院。應該點樣送院？',o:['🏥 通報後分流去屯門醫院','🏥 送屬區天水圍醫院'],dest:['tmh','tsh'],why:'院前中風通報及分流：天水圍醫院屬區嘅病人 FAST-ED ≥ 4 分，分流至屯門醫院，並要預先通報，方便盡快做溶栓治療。'},
  tips:['記住 FAST：面、手、講嘢、時間','記低病發或者最後正常嘅時間，即刻打 999','唔好俾病人飲嘢食嘢，以免哽親']},
 {id:'tswarrest',place:'屏山聚星樓',poi:'jusing',title:'伯伯心臟驟停',call:'屏山聚星樓外，一位 70 歲伯伯行行下突然暈低。救護員到場時佢冇反應、冇正常呼吸，途人已經開始做心肺復甦。最就近係天水圍醫院。',
  steps:['救護員確認心臟驟停，接手做心肺復甦','貼上除顫器電極片，分析心律，需要時電擊','繼續心肺復甦，盡快送最就近醫院'],
  quiz:[{q:'自動心臟除顫器（AED）分析完講「建議電擊」，應該點做？',o:['大聲叫所有人唔好掂病人，確認冇人掂先按電擊鍵','一邊按住胸口一邊按電擊鍵','唔使理，繼續按壓就得'],why:'電擊前一定要確保冇人接觸病人，電擊後即刻繼續胸外按壓，跟住 AED 語音指示。'}],
  equip:{q:'伯伯心臟驟停，救護員最需要即刻用咩裝備？',o:['⚡ 自動心臟除顫器（AED）','🦴 夾板','🩹 燒傷敷料','💨 霧化器'],why:'心臟驟停要盡快做心肺復甦同使用除顫器，越早除顫，存活機會越高。'},
  triage:{q:'伯伯心臟驟停，持續心肺復甦中。應該送邊間？',o:['🏥 天水圍醫院（最就近）','🏥 屯門醫院（較遠）'],dest:['tsh','tmh'],why:'心臟驟停病人要以最快時間送到醫院，所以送最就近醫院，途中持續做高質素心肺復甦。'},
  tips:['見到有人冇反應、冇正常呼吸，即刻打 999 並開始心肺復甦','附近有 AED 就盡快攞嚟用，跟住語音指示','用力、快速按壓胸口中央，每分鐘 100 至 120 下']},
 {id:'mass',place:'屯門市廣場',poi:'plaza',title:'大量傷者事故',call:'屯門市廣場有扶手電梯意外，多人受傷！控制中心已派出多架救護車一齊前往。',
  steps:['救護員為傷者分流，貼上紅、黃、綠分流卡','先處理同運送傷勢最重（紅卡）嘅傷者','其他救護車接載餘下傷者'],
  quiz:[{q:'大量傷者事故，救護員到場後最先做咩？',o:['傷者分流：按傷勢輕重排先後','邊個叫得最大聲就先救邊個','將所有傷者送去同一間醫院'],why:'分流可以喺資源有限時，令傷勢最危急嘅傷者最快得到治療，傷者亦會分送唔同醫院。'}],
  equip:{q:'大量傷者現場，救護員用咩幫傷者分類？',o:['🏷️ 分流卡（紅黃綠標籤）','🦴 夾板','💨 霧化器','🩸 血糖機'],why:'分流卡用顏色標示傷勢緩急：紅色最危急、黃色次之、綠色傷勢較輕，方便其他救護人員一眼睇到。'},
  tips:['大量傷者現場要聽從救護員同警察指示','傷勢較輕又行到嘅人，可以按指示去指定位置等候','唔好圍觀，讓出通道俾救護車']}
];
/* ---------- 關卡 ---------- */
const LEVELS_TM=[
 {id:'L1',caseId:'plaza',  tod:'day',  todName:'日間',      cars:16,works:0,jam:0,dash:0,limit:1.9},
 {id:'L2',caseId:'park',   tod:'day',  todName:'日間',      cars:22,works:1,jam:0,dash:1,limit:1.8},
 {id:'L3',caseId:'townhall',tod:'dusk',todName:'黃昏',      cars:26,works:1,jam:1,dash:1,limit:1.7},
 {id:'L4',caseId:'station',tod:'night',todName:'夜晚',      cars:22,works:1,jam:1,dash:2,limit:1.7},
 {id:'L5',caseId:'market', tod:'rain', todName:'夜晚落雨',  cars:24,works:2,jam:1,dash:2,limit:1.8},
 {id:'L6',caseId:'crash',  tod:'day',  todName:'日間',      cars:24,works:0,jam:1,dash:1,limit:1.7,support:['police','fire']},
 {id:'L7',caseId:'mass',   tod:'dusk', todName:'黃昏',      cars:22,works:1,jam:0,dash:1,limit:1.7,escort:4},
 {id:'L8',caseId:'yltrauma',tod:'day', todName:'日間・元朗',  cars:22,works:0,jam:0,dash:1,limit:2.0,depot:'yl',support:['moto','fire']},
 {id:'L9',caseId:'ylstroke',tod:'night',todName:'夜晚・元朗',  cars:20,works:0,jam:1,dash:1,limit:2.0,depot:'yl'},
 {id:'L10',caseId:'ylarrest',tod:'dusk',todName:'黃昏・元朗',  cars:20,works:0,jam:0,dash:1,limit:2.0,depot:'yl',support:['moto']},
 {id:'L11',caseId:'tswtrauma',tod:'day',todName:'日間・天水圍',cars:22,works:0,jam:1,dash:1,limit:2.0,depot:'tsw',support:['police']},
 {id:'L12',caseId:'tswstroke',tod:'dusk',todName:'黃昏・天水圍',cars:20,works:1,jam:0,dash:1,limit:2.0,depot:'tsw'},
 {id:'L13',caseId:'tswarrest',tod:'night',todName:'夜晚・天水圍',cars:20,works:0,jam:1,dash:1,limit:2.0,depot:'yl',support:['moto']}];
/* ---------- 救護任務（沙田）：6 關 ---------- */
CASES.push(
 {id:'sttrauma',place:'沙田公園單車徑',poi:'stpark',title:'單車相撞',call:'沙田公園城門河單車徑，兩架單車相撞，一名男子跌落地。佢醒，但講嘢斷斷續續，呼吸每分鐘 34 次、急速，血壓 118/76。',
  steps:['救護員評估氣道、呼吸、循環同清醒程度','固定頸椎，處理傷口，給予氧氣','按創傷分流準則決定送院，並預先通報'],
  quiz:[{q:'以下邊個生命表徵，符合「創傷分流」準則？',o:['呼吸每分鐘 ≥ 30 次','血壓 118/76','脈搏每分鐘 88'],why:'資料庫創傷分流準則：呼吸每分鐘 < 10 或 ≥ 30、收縮壓 < 90 mmHg、GCS 3–13、成人由 6 米以上墮下等，都要送創傷中心。'}],
  equip:{q:'單車相撞、跌落地，懷疑頸椎受傷，救護員應該用咩裝備？',o:['🦺 頸套同脊椎板','🩸 血糖機','💨 Ventolin 噴劑','📈 12 導程心電圖'],why:'撞車同跌倒有機會傷及頸椎同脊椎，要先固定再搬動。'},
  triage:{q:'傷者呼吸每分鐘 34 次，符合創傷分流準則。應該送邊間？',o:['🏥 威爾斯親王醫院（創傷中心，預先通報）','🏥 沙田醫院'],dest:['pwh','pwh'],why:'威爾斯親王醫院本身係新界東嘅創傷中心，沙田區傷者直接送去，並預先通報醫院準備。沙田醫院唔提供急症室服務，唔可以送去。'},
  tips:['喺單車徑見到意外，先留意自身安全，提醒其他單車停低','唔好隨便移動傷者，即刻打 999','用乾淨布料按住流血位置']},
 {id:'ststroke',place:'車公廟',poi:'stck',title:'婆婆懷疑中風',call:'車公廟，一位 72 歲婆婆 1 個鐘前突然右邊手腳無力、口角歪斜。血壓 168/92、GCS 15、H\'stix 7.2。屬區醫院係威爾斯親王醫院。',
  steps:['救護員驗血糖，排除血糖過低','做 FAST-ED 評分','按屬區通報，送院'],
  quiz:[{q:'院前中風通報要符合咩時間條件？',o:['病發或最後正常時間喺 4 小時內','病發喺 24 小時內','冇時間限制'],why:'院前中風通報要病發或最後正常時間喺 4 小時內，18 歲或以上、SBP > 100 mmHg 及 GCS ≥ 8，並已排除血糖過低。'}],
  equip:{q:'婆婆突然一邊手腳無力，做中風評估之前要先排除咩？揀啱裝備：',o:['🩸 血糖機','🦺 頸套同脊椎板','💨 Ventolin 噴劑','📈 12 導程心電圖'],why:'血糖過低可以引起類似中風嘅症狀，要先驗血糖（H\'stix > 4.0 mmol/L）。'},
  triage:{q:'FAST-ED 5 分，病發 1 個鐘，屬區係威爾斯親王醫院。應該點樣送院？',o:['🏥 按屬區通報，直接送威爾斯親王醫院','🏥 分流去那打素醫院'],dest:['pwh','pwh'],why:'資料庫：如原本之屬區醫院為 PWH 或 TMH，不屬於分流，按屬區通報送院。反而係那打素醫院、北區醫院屬區嘅病人 FAST-ED ≥ 4 分，先要分流到威爾斯親王醫院。'},
  tips:['記住 FAST：面、手、講嘢、時間','記低病發或者最後正常嘅時間','唔好俾病人飲嘢食嘢']},
 {id:'starrest',place:'新城市廣場',poi:'stntp',title:'商場有人暈低',call:'新城市廣場，一位 55 歲男子行街時突然暈低，冇反應、冇正常呼吸。保安已經開始做心肺復甦，同埋攞咗商場嘅 AED。',
  steps:['救護員確認心臟驟停，接手做心肺復甦','用除顫器分析心律，需要時電擊','繼續心肺復甦，盡快送最就近醫院'],
  quiz:[{q:'救護員到場，AED 已經貼咗電極片。分析心律期間應該點？',o:['停止按壓，所有人唔好接觸病人','繼續按壓，唔使理','郁動病人方便上擔架'],why:'分析心律期間任何接觸或者郁動都會影響分析，要停手、唔好接觸病人，跟住 AED 語音指示。'}],
  equip:{q:'男子心臟驟停，救護員最需要即刻用咩裝備？',o:['⚡ 自動心臟除顫器（AED）','🩸 血糖機','💨 Ventolin 噴劑','🦺 頸套同脊椎板'],why:'心臟驟停要盡快做心肺復甦同電擊，越早除顫存活機會越高。'},
  triage:{q:'男子心臟驟停，持續心肺復甦中。應該送邊間？',o:['🏥 威爾斯親王醫院（最就近急症室）','🏥 沙田醫院'],dest:['pwh','pwh'],why:'心臟驟停要以最快時間送到最就近有急症室嘅醫院，即係威爾斯親王醫院，途中持續做高質素心肺復甦。'},
  tips:['見到有人冇反應、冇正常呼吸，即刻打 999 同開始 CPR','商場通常有 AED，叫人攞嚟','用力、快速按壓胸口中央']},
 {id:'sthypo',place:'沙田第一城',poi:'stcity',title:'糖尿伯伯神志不清',call:'沙田第一城，一位 68 歲伯伯有糖尿病，早上打完胰島素冇食早餐，而家冒冷汗、手震、講嘢含糊。佢仲識吞嚥。',
  steps:['救護員評估清醒程度，驗血糖：H\'stix 2.8 mmol/L','問 MIAMIA：食嘢、胰島素、活動、藥物、病、酒','按 Glycemia protocol 處理'],
  quiz:[{q:'伯伯第一次 H\'stix 2.8 mmol/L，清醒、識吞嚥。按資料庫應該點處理？',o:['口服 D10W 糖水 200 ml','即刻打 IV 鹽水','唔使處理，送院先算'],why:'Glycemia：第一次 H\'stix ≦ 4 而病人識吞嚥，可以口服 D10W 每次 200 ml（口服唔需要 Thiamine），之後再驗血糖。'}],
  equip:{q:'糖尿病人冒冷汗、手震、講嘢含糊，救護員要即刻用咩裝備？',o:['🩸 血糖機','📈 12 導程心電圖','💨 Ventolin 噴劑','🦺 頸套同脊椎板'],why:'清醒程度下降或神經功能急性變化，要即刻驗血糖，≦ 4 mmol/L 或 > 20 mmol/L 就要按 Glycemia protocol 處理。'},
  tips:['糖尿病人冒冷汗、手震、神志不清，可能係血糖過低','如果病人清醒、識吞嚥，可以俾佢食啲糖','神志唔清嘅病人唔好餵嘢食，以免哽親']},
 {id:'stasthma',place:'沙田馬場',poi:'strace',title:'哮喘發作',call:'沙田馬場，一位 30 歲女士有哮喘病歷，睇馬期間突然氣促、有喘鳴聲，講嘢一句斷一句，SpO2 92%。佢冇帶自己嘅噴劑。',
  steps:['救護員檢查 SpO2，給予氧氣','聽肺，量維生指數','確認適用症、排除禁忌症，給予 Ventolin'],
  quiz:[{q:'女士 30 歲，按 Respiratory protocol，Ventolin 每次劑量係幾多？',o:['400 mcg（4 下）','200 mcg（2 下）','300 mcg（3 下）'],why:'Salbutamol（Ventolin）：12 歲或以上 400 mcg（4 puffs）；5 至 < 12 歲 300 mcg；2 至 < 5 歲 200 mcg。仍然氣促，相隔 5 分鐘可以再俾下一劑。'}],
  equip:{q:'哮喘病人氣促、有喘鳴聲，救護員應該用咩藥物裝備？',o:['💨 Ventolin 噴劑（配儲霧器）','🩸 血糖機','📈 12 導程心電圖','🦺 頸套同脊椎板'],why:'主要不適為氣促，而病人有哮喘病歷，符合 Ventolin 適用症（要先排除對 Ventolin 敏感）。'},
  tips:['哮喘病人應該隨身帶備自己嘅噴劑','幫病人坐直身，保持冷靜','如果氣促加劇、嘴唇發紫，即刻打 999']},
 {id:'stcardiac',place:'萬佛寺',poi:'stbuddha',title:'行山後胸口痛',call:'萬佛寺山腳，一位 58 歲男士行完樓梯後胸口好似俾大石壓住，痛到左手，冒冷汗，已經 20 分鐘。血壓 146/88、脈搏 96、GCS 15。冇藥物過敏。',
  steps:['救護員問 OPQRST，評估懷疑心源性胸痛','排除禁忌症，給予 ASA','做 12 導程心電圖，盡快送院'],
  quiz:[{q:'以下邊個情況，唔可以俾病人服用 ASA（阿士匹靈）？',o:['病人對 ASA 或 NSAIDs 過敏','病人 58 歲','血壓 146/88'],why:'ASA 禁忌症（SAPHBUS）：唔識吞嚥、< 12 歲、懷孕、對 ASA 或 NSAIDs 過敏、不能控制嘅出血、24 小時內已因今次不適服用、一星期內做過手術；裝有 LVAD 亦唔可以。劑量係 200 mg，只俾一次。'}],
  equip:{q:'懷疑心源性胸痛，救護員應該用咩裝備評估心臟？',o:['📈 12 導程心電圖','🩸 血糖機','💨 Ventolin 噴劑','🦺 頸套同脊椎板'],why:'12 歲或以上有心源性胸痛或不適，可以做 12-Lead ECG；如情況許可，盡量喺給予相應治療後喺現場做。'},
  tips:['胸口好似俾大石壓住、痛到手臂或下巴，可能係心臟病','即刻停低休息，打 999','唔好自己揸車去醫院']},
 {id:'stbleed',place:'沙田運動場',poi:'stsport',title:'跑步跌倒流血',call:'沙田運動場，一名 40 歲男子跑步時跌倒，膝頭同手臂擦傷，前臂有一條深傷口不停流血。佢清醒，有少少頭暈。',
  steps:['救護員戴手套，用敷料直接加壓止血','檢查有冇其他傷勢，量維生指數','包紮固定傷口，送院處理'],
  quiz:[{q:'傷口不停流血，第一時間應該點做？',o:['用乾淨布料直接用力按住傷口','先用水沖走啲血再算','用紙巾抹乾就得'],why:'直接加壓係最有效嘅止血方法。按住唔好放手；血滲出嚟就喺上面再加一層，唔好拎走第一層。'}],
  equip:{q:'前臂傷口流血不止，救護員應該用咩裝備？',o:['🩹 加壓敷料同繃帶','🩸 血糖機','💨 Ventolin 噴劑','📈 12 導程心電圖'],why:'加壓敷料可以直接壓住傷口止血，再用繃帶包紮固定。'},
  tips:['流血時用乾淨布料直接用力按住傷口','血滲出唔好拎走敷料，再加一層繼續按','處理傷口前後要洗手，可以嘅話戴手套']},
 {id:'stallergy',place:'禾輋廣場',poi:'stwoche',title:'食物嚴重過敏',call:'禾輋廣場食肆，一位 25 歲女士食完嘢之後成身出紅疹、口唇同眼腫，聲沙、氣促。佢話自己對花生過敏，手袋入面有腎上腺素自動注射器。',
  steps:['救護員評估氣道同呼吸，給予氧氣','協助使用腎上腺素，量維生指數','密切監察，盡快送院'],
  quiz:[{q:'有人嚴重過敏、氣促，身上有醫生處方嘅腎上腺素自動注射器，應該點做？',o:['協助佢喺大腿外側注射，然後即刻打 999','叫佢飲多啲水沖淡','等症狀自己退咗先算'],why:'嚴重過敏反應可以好快危及生命。病人有醫生處方嘅腎上腺素自動注射器，應該協助佢喺大腿外側使用，並立即召救護車。'}],
  equip:{q:'女士嚴重過敏、聲沙氣促，救護員最需要即刻準備咩藥物？',o:['💉 腎上腺素（Adrenaline）','🩸 血糖機','🦺 頸套同脊椎板','🩹 加壓敷料同繃帶'],why:'嚴重過敏反應嘅首要藥物係腎上腺素，可以紓緩氣道腫脹同血壓下降。'},
  tips:['知道自己有嚴重過敏，要隨身帶備醫生處方嘅腎上腺素注射器','面腫、聲沙、氣促係危險訊號，即刻打 999','用咗腎上腺素注射器都一定要送院觀察']},
 {id:'stseizure',place:'沙田站',poi:'ststn',title:'抽筋後人事不省',call:'沙田站大堂，一名 30 歲男子突然倒地全身抽搐，大約兩分鐘後停止。依家叫佢冇反應，但有呼吸。途人話佢有癲癇病史。',
  steps:['救護員評估氣道同呼吸，檢查有冇撞傷','擺復原臥式，給予氧氣，驗血糖','監察清醒程度，送院'],
  quiz:[{q:'有人抽筋（癲癇發作）期間，旁人應該點做？',o:['移開附近硬物、保護佢個頭，記低抽筋時間','塞嘢入佢口，防止咬脷','用力按住佢手腳，令佢停'],why:'抽筋期間唔好塞任何嘢入口，亦唔好強行按住。移開危險物件、保護頭部、記低時間；停咗之後有呼吸就擺側臥。抽筋超過 5 分鐘要即刻打 999。'}],
  equip:{q:'男子抽筋後冇反應，救護員要即刻排除邊個常見原因？揀啱裝備：',o:['🩸 血糖機','🩹 加壓敷料同繃帶','💨 Ventolin 噴劑','🦺 頸套同脊椎板'],why:'血糖過低都可以引致抽筋同昏迷，救護員要盡快驗血糖。'},
  tips:['抽筋時唔好塞嘢入口，亦唔好強行按住','保護頭部，記低抽筋開始同停止嘅時間','抽筋停咗仍然冇反應，有呼吸就擺側臥']},
 {id:'stbreath',place:'曾大屋',poi:'sttsang',title:'伯伯嚴重氣促',call:'曾大屋附近，一位 75 歲伯伯行完樓梯之後非常氣促，坐低都唔夠氣，嘴唇有啲發紫，講嘢只講到幾個字。佢有慢性肺病。',
  steps:['救護員檢查 SpO2，給予氧氣','聽肺，量維生指數','讓伯伯坐直身，盡快送院'],
  quiz:[{q:'有人嚴重氣促，等救護車期間應該點樣幫佢？',o:['讓佢坐直身或身向前傾，鬆開緊身衣物','叫佢平躺瞓低休息','叫佢行吓透吓氣'],why:'坐直或身向前傾可以幫助呼吸，亦要鬆開衣領、保持空氣流通。嘴唇發紫、講唔到完整句子係危險訊號，要即刻打 999。'}],
  equip:{q:'伯伯嚴重氣促、嘴唇發紫，救護員應該即刻俾咩？',o:['🫁 氧氣','🩸 血糖機','🦺 頸套同脊椎板','🩹 加壓敷料同繃帶'],why:'病人血含氧量低，救護員會用 SpO2 監察，按需要給予氧氣。'},
  tips:['嚴重氣促時坐直或身向前傾','講唔到完整句子、嘴唇發紫，即刻打 999','病人有醫生處方嘅噴劑，可以協助佢使用']},
 {id:'stfever',place:'沙田大會堂',poi:'sttownh',title:'婆婆發燒神志混亂',call:'沙田大會堂，一位 80 歲婆婆發燒咗兩日，今日睇表演期間變得神志混亂、好虛弱，企都企唔穩，摸落身體好熱。',
  steps:['救護員量體溫、血壓、脈搏同 SpO2','評估清醒程度，驗血糖','保持婆婆舒適，送院'],
  quiz:[{q:'有人發燒，以下邊個情況要即刻打 999？',o:['發燒加上神志混亂、叫唔醒或者呼吸困難','體溫 38°C 但精神正常','發燒之後出咗身汗'],why:'發燒本身唔一定危險，但加上神志混亂、昏睡、呼吸困難或者出紅疹按都唔褪色，可能係嚴重感染，要即刻打 999。'}],
  equip:{q:'婆婆發燒、神志混亂，救護員要先量咩？揀啱裝備：',o:['🌡️ 體溫計','🦺 頸套同脊椎板','💨 Ventolin 噴劑','🩹 加壓敷料同繃帶'],why:'救護員會量體溫同其他維生指數，評估有冇嚴重感染嘅跡象。'},
  tips:['發燒時多飲水，穿著輕便衣物','唔好用冰水或者酒精抹身','發燒加神志混亂或呼吸困難，即刻打 999']}
);
const LEVELS_ST=[
 {id:'S1',caseId:'sttrauma',tod:'day',todName:'日間・沙田',cars:22,works:0,jam:1,dash:1,limit:2.0,depot:'st',support:['police']},
 {id:'S2',caseId:'ststroke',tod:'day',todName:'日間・大圍',cars:20,works:0,jam:0,dash:1,limit:2.0,depot:'ts'},
 {id:'S3',caseId:'starrest',tod:'night',todName:'夜晚・沙田',cars:20,works:0,jam:1,dash:1,limit:2.0,depot:'st',support:['moto','fire']},
 {id:'S4',caseId:'sthypo',tod:'dusk',todName:'黃昏・沙田',cars:22,works:1,jam:0,dash:1,limit:2.0,depot:'st'},
 {id:'S5',caseId:'stasthma',tod:'dusk',todName:'黃昏・火炭',cars:22,works:0,jam:1,dash:1,limit:2.0,depot:'st'},
 {id:'S6',caseId:'stcardiac',tod:'rain',todName:'落雨・沙田',cars:20,works:0,jam:1,dash:1,limit:2.0,depot:'ts'},
 {id:'S7',caseId:'stbleed',tod:'day',todName:'日間・沙田',cars:20,works:0,jam:0,dash:1,limit:2.0,depot:'st'},
 {id:'S8',caseId:'stallergy',tod:'dusk',todName:'黃昏・禾輋',cars:20,works:0,jam:1,dash:1,limit:2.0,depot:'st'},
 {id:'S9',caseId:'stseizure',tod:'night',todName:'夜晚・沙田',cars:18,works:0,jam:0,dash:1,limit:2.0,depot:'ts'},
 {id:'S10',caseId:'stbreath',tod:'day',todName:'日間・大圍',cars:20,works:0,jam:0,dash:1,limit:2.0,depot:'ts'},
 {id:'S11',caseId:'stfever',tod:'rain',todName:'落雨・沙田',cars:18,works:0,jam:1,dash:1,limit:2.0,depot:'st'}];

// 🏥 沙田救護任務（簡單）：題目改做一般急救常識——唔涉及消防處 Protocol、藥物劑量或者醫院分流，小朋友同有基本急救知識嘅市民都答到
const ST_EASY={
 sttrauma:{call:'沙田公園城門河單車徑，兩架單車相撞，一名男子跌落地，手臂擦傷流血，話條頸好痛。佢醒，但好驚。',
  steps:['救護員確保現場安全，叫其他單車停低','檢查傷勢，固定頸部，唔好亂郁','包紮傷口，用擔架送院'],
  quiz:[{q:'有人踩單車跌親，話條頸好痛，你應該點做？',o:['叫佢唔好郁，保持原位，即刻打 999','扶佢起身行兩步試吓','幫佢郁吓個頭睇吓有冇事'],why:'頸痛可能傷咗頸骨，亂郁會令傷勢加重。叫傷者保持唔郁，打 999 等救護員嚟處理。'}],
  equip:{q:'傷者條頸好痛，救護員會用咩保護佢條頸？',o:['🦺 頸箍同擔架','🩸 驗血糖機','🌡️ 體溫計','❄️ 冰袋'],why:'頸箍可以固定頸部，再用擔架搬動，避免傷勢加重。'},triage:null},
 ststroke:{call:'車公廟，一位 72 歲婆婆突然右邊手腳無力、口角歪斜，講嘢含糊不清。家人話佢一個鐘前仲好好地。',
  steps:['救護員用「FAST」檢查面、手同講嘢','記低病發時間，驗血糖','盡快送院'],
  quiz:[{q:'認中風嘅口訣「FAST」，入面個「T」代表咩？',o:['時間（Time）：記低病發時間，即刻打 999','溫度（Temperature）：先量體溫','休息（Take a rest）：等佢休息一陣先'],why:'F 係面（Face）歪、A 係手（Arm）無力、S 係講嘢（Speech）含糊、T 係時間（Time）。中風越快送院越好，見到就要記低時間同即刻打 999。'}],
  equip:{q:'血糖太低都會令人手腳無力、講嘢唔清。救護員會用咩工具睇吓婆婆血糖有冇問題？',o:['🩸 驗血糖機','🦺 頸箍同擔架','❄️ 冰袋','🩹 紗布同繃帶'],why:'驗血糖機刺手指取一滴血，就知道血糖係咪太低。'},triage:null},
 starrest:{steps:['救護員接手做心肺復甦（CPR）','用 AED 分析，需要時電擊','繼續 CPR，盡快送院'],
  quiz:[{q:'見到有人突然暈低，叫佢冇反應、冇正常呼吸，你應該點做？',o:['叫人打 999 同攞 AED，自己即刻做 CPR 按心口','搖佢、淋水等佢醒','扶佢坐起身飲水'],why:'冇反應、冇正常呼吸，可能係心臟停頓。要即刻打 999、做 CPR（用力、快速按胸口中央），同盡快用 AED。'}],
  equip:{q:'男子心臟停咗，最需要即刻用邊樣嘢？',o:['⚡ AED 自動心臟除顫器','🌡️ 體溫計','❄️ 冰袋','🩹 膠布'],why:'心臟停頓要盡快做 CPR 同用 AED 電擊。AED 會用把聲教你點用，越早用，救返嘅機會越高。'},triage:null},
 sthypo:{call:'沙田第一城，一位 68 歲伯伯有糖尿病，今朝打完針冇食早餐，而家冒冷汗、手震、講嘢有啲含糊，但仲識吞嘢。',
  steps:['救護員檢查伯伯清唔清醒，驗血糖','血糖太低，伯伯清醒識吞，就俾佢食糖','再驗血糖，送院'],
  quiz:[{q:'糖尿病人冒冷汗、手震，但仲清醒識吞嘢，你可以點幫佢？',o:['俾佢食糖，或者飲果汁、有糖嘅飲品','俾佢飲大量清水','叫佢瞓覺休息'],why:'可能係血糖過低。病人清醒又識吞嘢，可以俾佢食糖或者飲有糖飲品；如果神志唔清就唔好餵嘢食，即刻打 999。'}],
  equip:{q:'救護員要知道伯伯血糖有幾低，會用咩？',o:['🩸 驗血糖機','⚡ AED 自動心臟除顫器','🦺 頸箍同擔架','❄️ 冰袋'],why:'驗血糖機刺手指取一滴血，就知道血糖高定低。'}},
 stasthma:{call:'沙田馬場，一位 30 歲女士有哮喘，睇馬期間突然好氣促，呼吸有「嘶嘶」聲，講嘢一句斷一句。佢冇帶自己嘅噴劑。',
  steps:['救護員叫佢坐直，俾氧氣','檢查呼吸同血含氧量','協助用哮喘噴劑，送院'],
  quiz:[{q:'有人哮喘發作好氣促，你應該點幫佢？',o:['叫佢坐直、保持冷靜，協助佢用自己嘅噴劑','叫佢瞓低休息','叫佢跑兩步透吓氣'],why:'坐直身比較容易呼吸。病人有自己醫生開嘅噴劑，可以幫佢用；越嚟越喘、嘴唇發紫，就即刻打 999。'}],
  equip:{q:'女士好氣促，救護員最快可以俾咩幫佢呼吸？',o:['🫁 氧氣','🩸 驗血糖機','🦺 頸箍同擔架','🌡️ 體溫計'],why:'氧氣可以幫氣促嘅病人，救護員會一路留意佢嘅呼吸。'}},
 stcardiac:{call:'萬佛寺山腳，一位 58 歲男士行完樓梯之後，胸口好似俾大石壓住，痛到左手，仲冒冷汗，已經痛咗 20 分鐘。',
  steps:['救護員叫佢停低休息，問清楚點樣痛','檢查心臟同脈搏、血壓','盡快送院'],
  quiz:[{q:'有人胸口好似俾大石壓住、冒冷汗，你應該點做？',o:['叫佢即刻停低休息，打 999','叫佢繼續行，當做運動','叫佢自己揸車去醫院'],why:'可能係心臟病發。要即刻停低休息、打 999，唔好自己揸車；如果佢暈低冇呼吸，就要做 CPR 同用 AED。'}],
  equip:{q:'救護員要睇吓男士個心跳成點，會用咩機？',o:['📈 心電圖機','🩸 驗血糖機','❄️ 冰袋','🦺 頸箍同擔架'],why:'心電圖機可以睇到心臟跳動嘅情況，幫醫生知道係咪心臟病發。'}},
 stbleed:{equip:{q:'前臂傷口流血不止，救護員會用咩止血？',o:['🩹 紗布同繃帶','🩸 驗血糖機','🫁 氧氣','🌡️ 體溫計'],why:'用紗布直接用力按住傷口止血，再用繃帶包好。'}},
 stallergy:{steps:['救護員檢查呼吸，俾氧氣','協助用腎上腺素注射筆','一路留意情況，送院'],
  quiz:[{q:'有人食完花生之後成身出紅疹、口唇腫、聲沙氣促，你應該點做？',o:['即刻打 999；佢有醫生開嘅腎上腺素注射筆，就協助佢用','叫佢飲多啲水沖淡','等一陣自己會好'],why:'嚴重過敏好快會危及生命。面腫、聲沙、氣促係危險訊號，要即刻打 999；病人有醫生開嘅腎上腺素注射筆，就協助佢喺大腿外側用。'}],
  equip:{q:'女士嚴重過敏、氣促，救護員會協助佢用咩？',o:['💉 腎上腺素注射筆','🩸 驗血糖機','🦺 頸箍同擔架','🩹 紗布同繃帶'],why:'腎上腺素可以紓緩嚴重過敏，令氣道同血壓好返啲。'}},
 stseizure:{steps:['救護員檢查呼吸，睇吓有冇撞親','擺側臥（復原臥式），驗血糖','留意清醒程度，送院'],
  equip:{q:'抽筋停咗之後仲叫唔醒，救護員會用咩睇吓係咪血糖太低引起？',o:['🩸 驗血糖機','🩹 紗布同繃帶','❄️ 冰袋','🦺 頸箍同擔架'],why:'血糖過低都會令人抽筋同昏迷，所以救護員會驗血糖。'}},
 stbreath:{steps:['救護員俾氧氣，檢查血含氧量','聽吓呼吸聲，量脈搏同血壓','讓伯伯坐直身，盡快送院'],
  equip:{q:'伯伯好氣促、嘴唇發紫，救護員會即刻俾咩？',o:['🫁 氧氣','🩸 驗血糖機','🦺 頸箍同擔架','🩹 紗布同繃帶'],why:'嘴唇發紫代表身體唔夠氧，救護員會俾氧氣，再一路留意。'}},
 stfever:{steps:['救護員量體溫、血壓同脈搏','檢查清醒程度，驗血糖','保持婆婆舒適，送院'],
  equip:{q:'婆婆發燒、神志混亂，救護員第一樣會量咩？',o:['🌡️ 體溫計','🦺 頸箍同擔架','⚡ AED 自動心臟除顫器','🩹 紗布同繃帶'],why:'先量體溫，再量其他維生指數，睇吓有冇嚴重感染。'}}};
if(REGION==='st') Object.entries(ST_EASY).forEach(([id,o])=>{ const c=CASES.find(x=>x.id===id); if(!c) return; Object.assign(c,o); if(o.triage===null) delete c.triage; });
// 🗺️ 沙田救護任務（困難）（沙田實景地圖）：同沙田關卡一樣嘅個案（保留 Protocol 題目），但地點全部用真實地址
const SR_ADDR={stpark:['沙田公園','源禾路2號'],stck:['車公廟','車公廟路'],stntp:['新城市廣場','沙田正街18號'],stcity:['沙田第一城','銀城街'],strace:['香港體育學院','源禾路25號'],stbuddha:['萬佛寺','排頭村221號'],
  stsport:['沙田運動場','源禾路18號'],stwoche:['禾輋廣場','德厚街3號'],ststn:['沙田站','沙田正街'],sttsang:['曾大屋','沙角街旁'],sttownh:['沙田大會堂','源禾路1號']};
if(REGION==='sr') LEVELS_ST.forEach(lv=>{ const c=CASES.find(x=>x.id===lv.caseId); if(!c||CASES.some(x=>x.id==='sr_'+c.id)) return; const k=JSON.parse(JSON.stringify(c)); const [nm,ad]=SR_ADDR[c.poi]||[c.place,'']; const np=nm+'（'+ad+'）';
  k.id='sr_'+c.id; k.place=np;
  if(c.poi==='strace') k.call=k.call.replace('沙田馬場',np).replace('睇馬期間','訓練期間');
  else if(k.call.includes(c.place)) k.call=k.call.replace(c.place,np); else k.call=k.call.replace(nm,np);
  CASES.push(k); });
const LEVELS_SR=LEVELS_ST.map((lv,i)=>Object.assign({},lv,{id:'R'+(i+1),caseId:'sr_'+lv.caseId}));
const LEVELS=REGION==='sr'?LEVELS_SR:REGION==='st'?LEVELS_ST:LEVELS_TM; const DEF_H=REGION!=='tm'?'pwh':'tmh';
const caseOf=lv=>CASES.find(c=>c.id===lv.caseId);

/* ---------- 地點 ---------- */
const HOSPS=REGION!=='tm'?{pwh:{stop:LMK.ae.stop,door:LMK.ae.door,name:'威爾斯親王醫院'}}:{tmh:{stop:LMK.ae.stop,door:LMK.ae.door,name:'屯門醫院'},poh:{stop:LMK.ae2.stop,door:LMK.ae2.door,name:'博愛醫院'},tsh:{stop:LMK.ae3.stop,door:LMK.ae3.door,name:'天水圍醫院'}};
const DEPOTS=REGION!=='tm'?{st:{pos:LMK.depot.pos,a:LMK.depot.a},ts:{pos:LMK.depotTS.pos,a:LMK.depotTS.a}}:{tm:{pos:LMK.depot.pos,a:LMK.depot.a},yl:{pos:LMK.depotYL.pos,a:LMK.depotYL.a},tsw:{pos:LMK.depotTSW.pos,a:LMK.depotTSW.a}};
let AE=HOSPS[DEF_H], DEPOT=DEPOTS[REGION!=='tm'?'st':'tm'];
const PARKED=(LMK.parkedAmb||[]).map(([[x,z],ang],i)=>{ const a=ambulance(['A245','A272'][i]||'A281'); a.userData.body.scale.setScalar(0.85); a.position.set(x,0.34,z); a.rotation.y=ang;
  a.userData.pB.intensity=a.userData.pR.intensity=0; a.userData.pB.visible=a.userData.pR.visible=false; a.userData.len=6; return {m:a,home:[x,z,ang]}; });

/* ---------- 畫面可見範圍：車同行人只喺鏡頭睇唔到嘅地方出現／消失 ---------- */
function spawnOK(x,z,r){ if(S.mode==='menu'||S.spawnFree) return true; if(inView(x,z,r)) return false; const c=S.car, dx=x-c.x, dz=z-c.z;
  return dx*Math.sin(c.a)+dz*Math.cos(c.a)<-10||Math.hypot(dx,dz)>150; } // 喺車後面或者好遠先出現
const FR=new THREE.Frustum(), FRM=new THREE.Matrix4(), FRS=new THREE.Sphere(new THREE.Vector3(),8);
function updFrustum(){ cam.updateMatrixWorld(); FRM.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse); FR.setFromProjectionMatrix(FRM); }
function inView(x,z,r=8){ r+=14; // 預留位：鏡頭轉動時都唔會見到出現／消失
  if(Math.hypot(x-cam.position.x,z-cam.position.z)>scene.fog.far+30) return false; FRS.center.set(x,2,z); FRS.radius=r; return FR.intersectsSphere(FRS); }
/* ---------- 交通車輛 ---------- */
/* ---------- 香港交通工具（參考相片：雙層巴士、綠色小巴、紅／綠的士、輕鐵） ---------- */
const VT={}; // 貼圖快取
function vtex(key,w,h,draw){ if(!VT[key]){ const t=canvasTex(w,h,draw,false); VT[key]=new THREE.MeshStandardMaterial({map:t,roughness:0.55}); } return VT[key]; }
// 六面盒：[+x, -x, 上, 下, 前(+z), 後(-z)]
function vbox(w,h,d,mats,parent,x,y,z,cast=true){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mats); m.position.set(x,y,z); m.castShadow=cast; m.receiveShadow=true; parent.add(m); return m; }
const solid=c=>M(c,{r:0.5});
function wheelsAt(body,list,r=0.45,wd=0.35){ list.forEach(([x,z])=>{ const w=add(cyl(r,r,wd,12),M(C.dark),body,x,r,z,false); w.rotation.z=Math.PI/2;
  add(cyl(r*0.55,r*0.55,wd+0.02,10),M(0xc9ced4),body,x,r,z,false).rotation.z=Math.PI/2; }); }
const led=(g,txt,x,y,size,col)=>{ g.fillStyle=col; g.font='bold '+size+'px sans-serif'; g.textBaseline='middle'; g.fillText(txt,x,y); };

/* 雙層巴士：紅色（銀色斜紋）／香檳金色（舊款） */
function busSide(style,frontLeft){ return vtex('bus'+style+frontLeft,1024,384,(g,W,H)=>{
  const X=x=>frontLeft?x:W-x, rect=(x0,y0,x1,y1)=>{ const a=X(x0),b=X(x1); g.fillRect(Math.min(a,b),y0,Math.abs(b-a),y1-y0); };
  if(style==='red'){ g.fillStyle='#e8343a'; g.fillRect(0,0,W,H);
    g.fillStyle='#c3c3c3'; g.beginPath(); g.moveTo(X(470),H); g.lineTo(X(560),H); g.lineTo(X(860),0); g.lineTo(X(800),0); g.fill(); // 銀色斜紋
    g.fillStyle='#16181c'; rect(20,40,950,150); rect(60,220,700,320); rect(830,220,1000,320); rect(860,40,1010,180); // 上下層窗、車頭
  } else { g.fillStyle='#bba98a'; g.fillRect(0,0,W,H);
    g.fillStyle='#1c1e22'; rect(40,40,1000,150); rect(260,220,1000,330); rect(30,220,150,360); rect(170,220,240,360);
    g.fillStyle='#f4f4f0'; rect(300,165,940,210); g.fillStyle='#2a8f4a'; g.font='bold 30px sans-serif'; g.textAlign='center'; g.fillText('環保人人想',X(620),188); }
  g.fillStyle='rgba(0,0,0,.25)'; g.fillRect(0,H-14,W,14); }); }
function busFront(style){ return vtex('busF'+style,256,384,(g,W,H)=>{ g.fillStyle=style==='red'?'#e8343a':'#bba98a'; g.fillRect(0,0,W,H);
  g.fillStyle='#16181c'; g.fillRect(14,14,W-28,140); g.fillRect(14,170,W-28,150);
  g.fillStyle='#000'; g.fillRect(36,170,W-72,50); led(g,style==='red'?'屯門 60X':'天瑞 69X',48,196,30,style==='red'?'#ffa31a':'#3ddc6a');
  g.fillStyle=style==='red'?'#c8c8c8':'#a8977a'; g.fillRect(10,330,W-20,22); g.fillStyle='#fffbe8'; g.fillRect(20,334,34,14); g.fillRect(W-54,334,34,14); }); }
function busModel(){ const g=new THREE.Group(), body=new THREE.Group(); g.add(body); const st=Math.random()<0.6?'red':'gold';
  const bc=st==='red'?'#e8343a':'#bba98a', bd=st==='red'?'#b3262b':'#94866b';
  const base=solid(st==='red'?0xe8343a:0xbba98a), back=vtex('busB2'+st,256,384,(c,W,H)=>{ c.fillStyle=bc; c.fillRect(0,0,W,H);
    c.fillStyle='#16181c'; c.fillRect(28,30,W-56,84);                                   // 上層車尾窗
    c.fillStyle='rgba(255,255,255,.14)'; c.beginPath(); c.moveTo(40,104); c.lineTo(90,38); c.lineTo(120,38); c.lineTo(70,104); c.fill();
    c.fillStyle='#16181c'; c.fillRect(150,126,82,30); led(c,'60X',162,142,22,'#ffb020');     // 路線牌
    c.fillStyle='#16181c'; c.fillRect(28,170,W-56,56);                                  // 下層車尾窗
    c.fillStyle=bd; c.fillRect(34,240,W-68,84); c.fillStyle='rgba(0,0,0,.28)'; for(let y=250;y<318;y+=11) c.fillRect(48,y,W-96,5);   // 引擎蓋散熱格
    [8,W-30].forEach(x=>{ c.fillStyle='#ff3030'; c.fillRect(x,236,22,34); c.fillStyle='#ffa31a'; c.fillRect(x,274,22,22); c.fillStyle='#f4f4f4'; c.fillRect(x,300,22,16); });
    c.fillStyle='#ffd400'; c.fillRect(92,334,72,22); c.fillStyle='#111'; c.font='bold 16px sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText('TM 60X',128,346); c.textAlign='left';
    c.fillStyle='#1c1e22'; c.fillRect(0,362,W,22); });
  const roof=vtex('busT2'+st,256,1024,(c,W,H)=>{ c.fillStyle=bc; c.fillRect(0,0,W,H);   // 車頂：同車身一樣顏色，只加深色線條
    c.strokeStyle=bd; c.lineWidth=6; c.strokeRect(10,10,W-20,H-20);
    c.lineWidth=3; for(let y=60;y<H-20;y+=90){ c.beginPath(); c.moveTo(22,y); c.lineTo(W-22,y); c.stroke(); }
    [[150,220],[620,220]].forEach(([y,h])=>{ c.lineWidth=6; c.strokeRect(56,y,W-112,h); c.lineWidth=3; for(let yy=y+18;yy<y+h-10;yy+=18){ c.beginPath(); c.moveTo(72,yy); c.lineTo(W-72,yy); c.stroke(); }
      c.lineWidth=5; c.beginPath(); c.arc(W/2,y+h/2,34,0,7); c.stroke(); });   // 冷氣機
    [430,900].forEach(y=>{ c.lineWidth=5; c.strokeRect(86,y,84,70); });        // 太平門
  });

  vbox(2.55,4.3,11.2,[busSide(st,true),busSide(st,false),roof,base,busFront(st),back],body,0,2.6,0);
  wheelsAt(body,[[-1.2,3.6],[1.2,3.6],[-1.2,-2.6],[1.2,-2.6],[-1.2,-3.9],[1.2,-3.9]],0.56,0.4);
  body.children[0].castShadow=true; scene.add(g); g.userData.len=11.2; addCarLights(g,body,'bus'); return g; }

/* 車燈：尾燈（剎車時好光）、頭燈（夜晚／落雨開），私家車加車牌；材質共用，靠換材質開關 */
const CARL={night:false,
  tlOff:new THREE.MeshStandardMaterial({color:0x8a1a1a,roughness:0.4}), tlRun:new THREE.MeshBasicMaterial({color:0xa01818}), tlOn:new THREE.MeshBasicMaterial({color:0xff2a2a}),
  hlOff:new THREE.MeshStandardMaterial({color:0xe9eef2,roughness:0.2}), hlOn:new THREE.MeshBasicMaterial({color:0xfff4cf}),
  plateR:new THREE.MeshStandardMaterial({color:0xffd400,roughness:0.6}), plateF:new THREE.MeshStandardMaterial({color:0xf4f4f4,roughness:0.6}),
  glow:null, G:new THREE.BoxGeometry(1,1,1), P:new THREE.PlaneGeometry(1,1)};
CARL.glow=new THREE.MeshBasicMaterial({map:canvasTex(64,128,(g,w,h)=>{ const gr=g.createRadialGradient(w/2,h*0.9,4,w/2,h*0.55,h*0.6); gr.addColorStop(0,'rgba(255,240,200,.9)'); gr.addColorStop(1,'rgba(255,240,200,0)'); g.fillStyle=gr; g.fillRect(0,0,w,h); },false),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0.55});
function addCarLights(g,body,kind){ if(CARL.skip){ g.userData.kind=kind; return; } const L=g.userData.len||4.4, hw=kind==='bus'?1.05:kind==='minibus'?0.88:0.8, ty=kind==='bus'?1.0:kind==='minibus'?0.95:1.05, z=L/2+0.03;
  const tl=[-1,1].map(s=>{ const m=new THREE.Mesh(CARL.G,CARL.tlOff); m.scale.set(kind==='bus'?0.3:0.36,kind==='bus'?0.5:0.2,0.08); m.position.set(s*hw,ty,-z); body.add(m); return m; });
  const hl=[-1,1].map(s=>{ const m=new THREE.Mesh(CARL.G,CARL.hlOff); m.scale.set(0.36,0.18,0.08); m.position.set(s*hw,kind==='bus'?0.85:0.9,z); body.add(m); return m; });
  if(kind==='car'){ const pr=new THREE.Mesh(CARL.G,CARL.plateR); pr.scale.set(0.62,0.18,0.04); pr.position.set(0,0.78,-z); body.add(pr); const pf=new THREE.Mesh(CARL.G,CARL.plateF); pf.scale.set(0.62,0.18,0.04); pf.position.set(0,0.66,z); body.add(pf); }
  const gl=new THREE.Mesh(CARL.P,CARL.glow); gl.rotation.x=-Math.PI/2; gl.scale.set(4.2,9,1); gl.position.set(0,0.09,z+4.6); gl.visible=false; gl.renderOrder=1; body.add(gl);
  g.userData.lt={tl,hl,gl,brk:null,night:null}; g.userData.kind=kind; }
// 每格：剎車燈、夜晚頭燈（只喺狀態改變時先換材質）
function carLights(m,brake){ const u=m.userData.lt; if(!u) return; const n=CARL.night;
  if(u.night!==n){ u.night=n; u.hl.forEach(h=>h.material=n?CARL.hlOn:CARL.hlOff); u.gl.visible=n; u.brk=null; }
  if(u.brk!==brake){ u.brk=brake; u.tl.forEach(h=>{ h.material=brake?CARL.tlOn:n?CARL.tlRun:CARL.tlOff; h.scale.y=(brake?1.25:1)*(h.userData.sy||(h.userData.sy=h.scale.y)); }); } }
/* 綠色專線小巴：米色車身、綠色車頂、車頭頂電子牌 */
function minibusModel(body,red){ const RC=red?'#c8202a':'#2fb07a', RK=red?'r':'';
  const side=f=>vtex('mb'+f+RK,512,192,(g,W,H)=>{ const X=x=>f?x:W-x; g.fillStyle='#f1e2b4'; g.fillRect(0,0,W,H); g.fillStyle=RC; g.fillRect(0,0,W,46);
    g.fillStyle='#fff'; g.font='bold 18px sans-serif'; g.textAlign='center'; g.fillText('公共小型巴士十九座位',X(300),30);
    g.fillStyle='#1c1e22'; const a=X(30),b=X(400); g.fillRect(Math.min(a,b),56,Math.abs(b-a),60); const c=X(410),d=X(480); g.fillRect(Math.min(c,d),56,Math.abs(d-c),70);
    g.fillStyle='rgba(0,0,0,.15)'; g.fillRect(0,H-10,W,10); });
  const front=vtex('mbF'+RK,256,192,(g,W,H)=>{ g.fillStyle='#f1e2b4'; g.fillRect(0,0,W,H); g.fillStyle=RC; g.fillRect(0,0,W,46); g.fillStyle='#1c1e22'; g.fillRect(14,52,W-28,70);
    g.fillStyle='#d9d9d9'; g.fillRect(24,140,40,18); g.fillRect(W-64,140,40,18); g.fillStyle='#2a2a2a'; g.fillRect(84,140,W-168,22); });
  const green=solid((red?0xc8202a:0x2fb07a)), cream=solid(0xf1e2b4);
  // 車尾：大後窗、綠色車頂、尾燈位、黃色車牌、後泵把（參考香港綠色專線小巴）
  const rear=vtex('mbB2'+RK,256,192,(g,W,H)=>{ g.fillStyle='#f1e2b4'; g.fillRect(0,0,W,H); g.fillStyle=RC; g.fillRect(0,0,W,40);
    g.fillStyle='#1c1e22'; g.fillRect(22,46,W-44,70); g.fillStyle='rgba(255,255,255,.16)'; g.beginPath(); g.moveTo(40,112); g.lineTo(80,50); g.lineTo(100,50); g.lineTo(60,112); g.fill();
    g.fillStyle='#111'; g.fillRect(W/2-46,50,92,22); led(g,red?'旺角':'44M',W/2-38,61,18,'#3ddc6a');
    g.fillStyle='#c9bb8e'; g.fillRect(W/2-1,118,2,40); g.fillStyle='#8a8a8a'; g.fillRect(W/2+10,134,18,5);
    g.fillStyle=RC; g.font='bold 15px sans-serif'; g.textAlign='center'; g.fillText('公共小型巴士',W/2,132);
    g.fillStyle='#ffd400'; g.fillRect(W/2-36,146,72,20); g.fillStyle='#111'; g.font='bold 15px sans-serif'; g.fillText('MB 2846',W/2,161);
    g.fillStyle='#2a2a2a'; g.fillRect(0,170,W,22); });
  vbox(2.3,2.5,7.0,[side(true),side(false),green,cream,front,rear],body,0,1.55,0);
  vbox(1.5,0.5,0.8,[green,green,green,green,vtex('mbLed'+RK,128,48,(g,W,H)=>{ g.fillStyle=RC; g.fillRect(0,0,W,H); g.fillStyle='#111'; g.fillRect(8,6,W-16,H-12); led(g,red?'旺角 佐敦':'44M 屯門',16,24,22,'#ffa31a'); }),green],body,0,3.0,3.0,false);
  wheelsAt(body,[[-1.05,2.3],[1.05,2.3],[-1.05,-2.2],[1.05,-2.2]],0.48,0.35); }

/* 的士：市區紅的（銀頂）／新界綠的（白頂），車頂 TAXI 牌 */
function taxiModel(body,green){
  const c=green?'#2bb04a':'#e3262e', top=green?0xf4f4f4:0xc9ccd0;
  const side=f=>vtex('tx'+green+f,256,96,(g,W,H)=>{ const X=x=>f?x:W-x; g.fillStyle=c; g.fillRect(0,0,W,H); g.fillStyle='#fff'; g.font='bold 20px sans-serif'; g.textAlign='center'; g.fillText('的士',X(150),36); g.font='bold 16px sans-serif'; g.fillText('TAXI',X(150),58);
    g.fillStyle='rgba(0,0,0,.25)'; g.fillRect(0,H-10,W,10); g.fillStyle='rgba(0,0,0,.18)'; g.fillRect(X(128)-1,10,2,H-24); });
  const front=vtex('txF'+green,256,96,(g,W,H)=>{ g.fillStyle=c; g.fillRect(0,0,W,H); g.fillStyle='#fff6d0'; g.fillRect(14,24,46,22); g.fillRect(W-60,24,46,22); g.fillStyle='#222'; g.fillRect(80,30,W-160,26); g.fillStyle='#fff'; g.fillRect(90,62,W-180,22); });
  const base=solid(green?0x2bb04a:0xe3262e);
  const rear=vtex('txB'+green,256,96,(g,W,H)=>{ g.fillStyle=c; g.fillRect(0,0,W,H); g.fillStyle='rgba(0,0,0,.18)'; g.fillRect(10,8,W-20,2);
    g.fillStyle='#fff'; g.font='bold 18px sans-serif'; g.textAlign='center'; g.fillText('的士 TAXI',W/2,30);
    g.fillStyle='#ffd400'; g.fillRect(W/2-38,44,76,22); g.fillStyle='#111'; g.font='bold 16px sans-serif'; g.fillText(green?'NT 5813':'HK 3927',W/2,61);
    g.fillStyle='#2a2a2a'; g.fillRect(0,76,W,20); });
  vbox(2.15,1.0,4.5,[side(true),side(false),base,base,front,rear],body,0,0.95,0);
  const roofM=solid(top), glass=M(C.glass,{r:0.2});
  vbox(1.9,0.85,green?2.3:2.9,[glass,glass,roofM,roofM,glass,glass],body,0,1.85,green?-0.25:-0.45);
  vbox(1.92,0.12,green?2.34:2.94,roofM,body,0,2.29,green?-0.25:-0.45,false);
  vbox(0.9,0.3,0.4,[solid(0xffffff),solid(0xffffff),solid(0xffffff),solid(0xffffff),vtex('taxiSign',128,48,(g,W,H)=>{ g.fillStyle='#fff'; g.fillRect(0,0,W,H); g.fillStyle='#d8202a'; g.font='bold 34px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('TAXI',W/2,H/2+2); }),solid(0xffffff)],body,0,2.5,-0.2,false);
  wheelsAt(body,[[-1.05,1.5],[1.05,1.5],[-1.05,-1.5],[1.05,-1.5]]); }

function carModel(kind){
  if(kind==='bus') return busModel();
  const g=new THREE.Group(), body=new THREE.Group(); g.add(body);
  if(kind==='minibus') minibusModel(body,GFX>=3&&Math.random()<0.45);
  else if(kind==='taxi') taxiModel(body,Math.random()<0.5);
  else { const col=[0x7fb8ff,0xffb3c1,0xc3a6ff,0xfff1a8,0xa8e6cf,0xe9edf2,0x5b6270][Math.random()*7|0];
    add(rbox(2.2,1.0,4.4,0.45),M(col),body,0,0.95,0); add(rbox(1.9,0.85,2.3,0.4),M(col),body,0,1.75,-0.2);
    add(new THREE.BoxGeometry(1.94,0.55,2.0),M(C.glass,{r:0.2}),body,0,1.78,-0.2,false);
    wheelsAt(body,[[-1.05,1.5],[1.05,1.5],[-1.05,-1.5],[1.05,-1.5]]); }
  g.traverse(o=>{ if(o.isMesh) o.castShadow=false; }); body.children[0].castShadow=true;
  if(kind==='minibus') g.userData.len=7.0;
  addCarLights(g,body,kind);
  scene.add(g); return g; }

/* 輕鐵：銀白車身、紅色腰線、紫綠間條、車頭黑色擋風、橙字路線牌、紅色集電弓 */
function lrtSide(cabLeft){ return vtex('lrt'+cabLeft,1024,256,(g,W,H)=>{ const X=x=>cabLeft?x:W-x, rect=(x0,y0,x1,y1)=>{ const a=X(x0),b=X(x1); g.fillRect(Math.min(a,b),y0,Math.abs(b-a),y1-y0); };
  g.fillStyle='#e9ebee'; g.fillRect(0,0,W,H);
  g.fillStyle='#c8102e'; rect(220,44,1024,62); g.fillStyle='#c8102e'; rect(196,44,232,62);
  g.fillStyle='#1f2328'; rect(240,70,1010,152); for(let x=330;x<1010;x+=96){ g.fillStyle='#cfd3d8'; rect(x,70,x+8,152); }
  for(let y=160;y<230;y+=6){ g.fillStyle=y%12?'#d7dade':'#c3c7cc'; rect(230,y,1024,y+3); }
  g.fillStyle='#b9a6e6'; rect(230,190,1024,195); g.fillStyle='#9bd23a'; rect(230,198,1024,203); g.fillStyle='#6c2c91'; rect(230,206,1024,210);
  // 車頭位置
  g.fillStyle='#f5f6f7'; rect(0,0,230,236); g.fillStyle='#1f2328'; rect(40,70,170,170);
  g.strokeStyle='#b9a6e6'; g.lineWidth=5; g.beginPath(); g.moveTo(X(20),205); g.quadraticCurveTo(X(140),185,X(230),192); g.stroke();
  g.strokeStyle='#9bd23a'; g.beginPath(); g.moveTo(X(20),213); g.quadraticCurveTo(X(140),195,X(230),200); g.stroke();
  g.strokeStyle='#6c2c91'; g.beginPath(); g.moveTo(X(20),221); g.quadraticCurveTo(X(140),203,X(230),208); g.stroke();
  g.fillStyle='#222'; g.font='bold 22px sans-serif'; g.textAlign='center'; g.fillText('1018',X(205),165);
  g.fillStyle='#4a4f56'; g.fillRect(0,236,W,20); }); }
const lrtFront=()=>vtex('lrtF',256,256,(g,W,H)=>{ g.fillStyle='#f5f6f7'; g.fillRect(0,0,W,H); g.fillStyle='#1f2328'; g.fillRect(18,10,W-36,150);
  g.fillStyle='#111'; g.fillRect(30,16,W-60,40); led(g,'元朗 610',44,37,26,'#ff8a1f'); led(g,'063',36,72,18,'#ff8a1f');
  g.fillStyle='#c8102e'; g.fillRect(40,168,W-80,26); g.fillStyle='#fff6d8'; g.fillRect(30,206,34,18); g.fillRect(W-64,206,34,18);
  g.fillStyle='#b9a6e6'; g.fillRect(0,228,W,4); g.fillStyle='#9bd23a'; g.fillRect(0,234,W,4); g.fillStyle='#4a4f56'; g.fillRect(0,240,W,16); });
function tramModel(){ const g=new THREE.Group(), body=new THREE.Group(); g.add(body);
  const white=solid(0xeef0f2), grey=solid(0x4a4f56);
  [[6.4,1],[-6.4,-1]].forEach(([z,dir])=>{ // 兩卡背對背，兩頭都係車頭
    const fr=lrtFront(); const mats=dir>0?[lrtSide(true),lrtSide(false),white,grey,fr,white]:[lrtSide(false),lrtSide(true),white,grey,white,fr];
    vbox(2.65,3.3,12.4,mats,body,0,2.05,z);
    add(new THREE.BoxGeometry(1.6,0.45,2.2),solid(0x5c6168),body,0,3.95,z-dir*3,false);  // 冷氣機
    add(new THREE.BoxGeometry(1.6,0.45,2.2),solid(0x5c6168),body,0,3.95,z-dir*0.4,false); });
  add(new THREE.BoxGeometry(2.4,3.0,0.6),grey,body,0,2.0,0,false);
  // 集電弓（紅色）同架空電線接觸
  const pm=solid(0xa3262e); const p1=add(new THREE.BoxGeometry(0.12,0.12,2.4),pm,body,0,4.8,5.0,false); p1.rotation.x=-0.75;
  const p2=add(new THREE.BoxGeometry(0.12,0.12,2.4),pm,body,0,4.8,3.6,false); p2.rotation.x=0.75; add(new THREE.BoxGeometry(1.8,0.1,0.25),solid(0x333333),body,0,5.65,4.3,false);
  body.children[0].castShadow=true; scene.add(g); g.userData.len=25; return g; }

// 停車場嘅車
const PARKM=[]; CARL.skip=true; parked.forEach(([x,z,a],k)=>{ const c=carModel(['car','car','taxi','minibus'][k%4]); c.position.set(x,0.34,z); c.rotation.y=a; PARKM.push(c); }); CARL.skip=false;   // 遠過 170 米唔畫
const cars=[]; const CAR_N=26;
function placeCar(c,nearX,nearZ){
  for(let tries=0;tries<40;tries++){
    const r=MAP.roads[Math.random()*MAP.roads.length|0]; if(r.closed) continue;
    const i=1+(Math.random()*(r.n.length-1)|0); const a=r.n[i-1], b=r.n[i];
    const A=NODES[a]; const d=Math.hypot(A[0]-nearX,A[1]-nearZ); if(d<60||d>340) continue;
    const fr=Math.random()<0.5?a:b, to=fr===a?b:a, t0=Math.random()*0.6; const P=NODES[fr],Q=NODES[to], px=P[0]+(Q[0]-P[0])*t0, pz=P[1]+(Q[1]-P[1])*t0;
    if(cars.some(o=>o!==c&&o.pose&&Math.hypot(o.pose.x-px,o.pose.z-pz)<16)) continue; // 唔好喺其他車上面出現
    if(!spawnOK(px,pz)) continue; // 唔好喺鏡頭前面突然出現
    Object.assign(c,{from:fr,to,road:r,t:t0,v:7+Math.random()*3,yield:0,pose:null,blockedBy:null}); return true; }
  return false;
}
function nextEdge(c){
  const opts=ADJ[c.to].filter(e=>e[0]!==c.from&&!e[2].closed);
  if(!opts.length){ c.t=1; c.waitEnd=true; return; } // 地圖盡頭：停喺度，等鏡頭睇唔到先喺第二度出現
  const e=opts[Math.random()*opts.length|0];
  c.from=c.to; c.to=e[0]; c.road=e[2]; c.t=0;
}
const HAZM=new THREE.MeshBasicMaterial({color:0xffa31a}), HAZG=new THREE.BoxGeometry(0.42,0.26,0.12);
function yieldHaz(k,on,t){ // 死火燈：車頭兩盞、車尾兩盞
  if(on&&!k.yh){ const L=k.m.userData.len||4.5, hz=L/2+0.03, hx=L>10?1.05:L>6?0.9:0.85, hy=L>10?0.9:1.0, par=k.m.children[0]||k.m;
    k.yh={on:false,m:[[-1,-1],[1,-1],[-1,1],[1,1]].map(([x,z])=>add(HAZG,HAZM,par,x*hx,hy,z*hz,false))}; }
  if(!k.yh) return; k.yh.on=on; const vis=on&&Math.floor(t*3)%2===0; k.yh.m.forEach(h=>h.visible=vis); }
function carPose(c){
  const A=NODES[c.from],B=NODES[c.to]; const dx=B[0]-A[0],dz=B[1]-A[1],L=Math.hypot(dx,dz)||1; const ux=dx/L,uz=dz/L;
  const off=c.yield>0?c.road.w/2-(c.m.userData.len?1.9:1.5):laneOff(c.road);
  c.off=(c.off??off)+(off-(c.off??off))*0.08;
  return {x:A[0]+dx*c.t+uz*c.off, z:A[1]+dz*c.t-ux*c.off, a:Math.atan2(ux,uz), L};
}
/* ---------- 行人 ---------- */
const peds=[]; const PED_N=34;
/* 巴士站等車嘅人：只擺最近兩個巴士站，每個三個人（共用 6 個模型） */
const BUSW={pool:[],t:0};
function busWaitTick(dt){ if(!NEON||!NEON.stops.length) return; if((BUSW.t-=dt)>0) return; BUSW.t=1;
  if(!BUSW.pool.length) for(let i=0;i<6;i++){ const m=pedModel(); m.visible=false; BUSW.pool.push(m); }
  const c=S.car, show=S.mode==='drive'||S.mode==='seq'||S.mode==='hseq';
  const near=show?NEON.stops.map(s=>[s,Math.hypot(s[0]-c.x,s[1]-c.z)]).filter(q=>q[1]<160).sort((a,b)=>a[1]-b[1]).slice(0,2):[];
  BUSW.pool.forEach((m,i)=>{ const q=near[Math.floor(i/3)]; if(!q){ m.visible=false; return; } const [x,z,nx,nz,ux,uz]=q[0], k=i%3-1, j=(i*7)%5*0.08;
    m.visible=true; m.position.set(x+ux*(k*1.25+j)-nx*(0.25+j),0.15,z+uz*(k*1.25+j)-nz*(0.25+j)); m.rotation.set(0,Math.atan2(-nx,-nz)+(k*0.35),0); }); }
// 行人跳開：跳去佢本身嗰邊（遠離車頭），落點唔可以係建築物
function pedDodge(p,c,lat){ const rx=Math.cos(c.a), rz=-Math.sin(c.a); let side=lat>=0?1:-1; const dist=VSPEC.kw*1.3+2.2-Math.abs(lat)*0.5;
  let x1=p.pos[0]+rx*side*dist, z1=p.pos[1]+rz*side*dist; if(cellAt(x1,z1)&2){ side=-side; x1=p.pos[0]+rx*side*(dist+Math.abs(lat)*2); z1=p.pos[1]+rz*side*(dist+Math.abs(lat)*2); }
  p.mode='jump'; p.jmp={t:0,x0:p.pos[0],z0:p.pos[1],x1,z1,side,ry:Math.atan2(rx*side,rz*side)}; }
function placePed(p,nearX,nearZ){
  for(let tries=0;tries<50;tries++){
    if(!S.noCross&&Math.random()<0.4){ const c=MAP.crossings[Math.random()*MAP.crossings.length|0]; const d=Math.hypot(c.p[0]-nearX,c.p[1]-nearZ); if(d<60||d>280) continue; if(!spawnOK(c.p[0],c.p[1],4)) continue;
      Object.assign(p,{mode:'cross',cx:c.p[0],cz:c.p[1],nx:c.n[0],nz:c.n[1],half:c.half,s:-c.half,dir:1,wait:Math.random()*4,node:SIGNAL[c.node]?c.node:null,ang:c.ang}); return true; }
    const r=MAP.roads[Math.random()*MAP.roads.length|0]; if(r.bridge) continue;
    const A=NODES[r.n[0]],B=NODES[r.n[1]]; const d=Math.hypot((A[0]+B[0])/2-nearX,(A[1]+B[1])/2-nearZ); if(d<50||d>280) continue;
    const L=Math.hypot(B[0]-A[0],B[1]-A[1]); const side=Math.random()<0.5?1:-1; if(!spawnOK(A[0],A[1],4)||!spawnOK(B[0],B[1],4)) continue;
    const lo=SIGNAL[r.n[0]]?CLR[r.n[0]]+5:1, hi=L-(SIGNAL[r.n[1]]?CLR[r.n[1]]+5:1); if(hi-lo<6) continue;
    if(r.elev) continue; Object.assign(p,{mode:'walk',A,B,L,s:lo+Math.random()*(hi-lo),lo,hi,dir:Math.random()<0.5?1:-1,off:(r.w/2+1.9)*side}); return true; }
  return false;
}
const PCOL=[0x7ec8e3,0xa78bfa,0xf9a8d4,0x86efac,0xfcd34d,0xfda4af,0x93c5fd];
const PG={body:new THREE.CylinderGeometry(0.42,0.5,1.0,10),head:new THREE.SphereGeometry(0.6,12,10),hair:new THREE.SphereGeometry(0.62,12,8,0,Math.PI*2,0,Math.PI/2),leg:new THREE.CylinderGeometry(0.15,0.15,0.6,6)};
const PM={skin:M(C.skin),hair:M(C.hair),leg:M(0x50586a)}, PCM=PCOL.map(c=>M(c));
function pedModel(){ // 簡化行人：5 件，唔投影，慳手機效能
  const g=new THREE.Group(); const mk=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); g.add(m); return m;};
  mk(PG.body,PCM[Math.random()*PCM.length|0],0,1.05,0); mk(PG.head,PM.skin,0,2.05,0); mk(PG.hair,PM.hair,0,2.1,-0.04);
  const legL=mk(PG.leg,PM.leg,-0.2,0.3,0), legR=mk(PG.leg,PM.leg,0.2,0.3,0);
  g.userData={legL,legR}; g.scale.setScalar(0.9); scene.add(g); return g; }

/* ---------- 高架路：車輛高度同斜度 ---------- */
function groundPose(m,x,y0,z,a,len){ const h=ELEV(x,z); m.rotation.order='YXZ'; m.position.set(x,y0+h,z); m.rotation.y=a;
  if(h>0||ELEV(x+Math.sin(a)*2,z+Math.cos(a)*2)>0){ const k=(len||4)/2, hf=ELEV(x+Math.sin(a)*k,z+Math.cos(a)*k), hb=ELEV(x-Math.sin(a)*k,z-Math.cos(a)*k); m.rotation.x=-Math.atan2(hf-hb,2*k); } else m.rotation.x=0; }
/* ---------- 輕鐵 ---------- */
const trams=REGION!=='tm'?[]:[0,1,2,3].map(k=>({L:TRAM,m:tramModel(),dir:k%2?-1:1,s:k*TRAM.len/4,wait:0,cur:9})).concat([0,1].map(k=>({L:TRAM2,m:tramModel(),dir:k%2?-1:1,s:k*TRAM2.len/2+20,wait:0,cur:9}))).concat([0,1].map(k=>({L:TRAM3,m:tramModel(),dir:k%2?-1:1,s:k*TRAM3.len/2+20,wait:0,cur:9})));
function tramTick(dt){ const c=S.car, tt=clock.elapsedTime, SV=window.__SV||[];
  for(const T of trams){
    let target=9; const TL=T.L; const p0=tramAt(T.s,TL); const off=T.dir>0?3.2:-3.2; // 靠左：同方向偏左
    const fx=Math.sin(p0.a)*T.dir, fz=Math.cos(p0.a)*T.dir, lx=fz, lz=-fx; const px=p0.x+lx*3.2, pz=p0.z+lz*3.2;
    const ex=c.x-px, ez=c.z-pz, ah=ex*fx+ez*fz; if(ah>0&&ah<22&&Math.abs(ex*lx+ez*lz)<3.6) target=0;
    for(const o of trams) if(o!==T&&o.L===T.L&&o.dir===T.dir){ const d=(o.s-T.s)*T.dir; if(d>0&&d<34) target=0; }
    if(T.pose) for(const o of cars){ if(!o.pose) continue; const qx=o.pose.x-T.pose.x, qz=o.pose.z-T.pose.z; const sa=Math.sin(T.pose.a), ca=Math.cos(T.pose.a); const al=qx*sa+qz*ca, ac=qx*ca-qz*sa; if(al>12&&al<24&&Math.abs(ac)<3) { target=0; break; } }
    // 紅燈
    for(let i=0;i<TL.seq.length;i++){ const k=TL.seq[i]; if(!SIGNAL[k]) continue; const rem=(TL.cum[i]-T.s)*T.dir, sd=CLR[k]+4.6+12.5;
      if(rem>sd-1&&rem<sd+20){ const st=lightState(k,p0.a,tt); if(st!=='g') target=Math.min(target,Math.max(0,(rem-sd)*0.8)); } }
    // 讓救護車：前面或者下一個路口附近有響警號嘅救護車就停
    if(T.pose) for(const sv of SV){ const qx=sv.x-T.pose.x, qz=sv.z-T.pose.z, d=Math.hypot(qx,qz); const ah=qx*Math.sin(T.pose.a)+qz*Math.cos(T.pose.a); if(d<38&&ah>-14) { target=0; break; } }
    const ds=(TL.lrt-T.s)*T.dir; if(T.wait>0){ T.wait-=dt; target=0; } else if(ds>0&&ds<0.5+T.cur*dt){ T.wait=5; T.s=TL.lrt; target=0; }
    else if(ds>0&&ds<20) target=Math.min(target,2+ds*0.35);
    T.cur+=(target-T.cur)*Math.min(1,dt*(target<T.cur?4:1)); T.s+=T.cur*T.dir*dt;
    if(T.s>TL.len+40) T.s=-40; if(T.s<-40) T.s=TL.len+40;
    const p=tramAt(T.s,TL); const ang=T.dir>0?p.a:p.a+Math.PI; const ux=Math.sin(ang), uz=Math.cos(ang);
    const x=p.x+uz*3.2, z=p.z-ux*3.2; T.pose={x,z,a:ang}; T.m.position.set(x,0.12,z); T.m.rotation.y=ang;
    T.m.visible=T.s>-5&&T.s<TL.len+5; if(!T.m.visible) T.pose=null; } }

/* ---------- 狀態 ---------- */
const S={mode:'menu',kase:null,step:0,car:{x:0,z:0,a:0,v:0},t0:0,tScene:0,tHosp:0,collided:false,collisions:0,
  target:null,route:null,routeT:0,seq:0,hold:{L:false,R:false,G:false,B:false},siren:false,camYaw:0,stars:0,ideal:0,lastHit:-9};
const routeMat=new THREE.MeshBasicMaterial({color:0xffd6a8,transparent:true,opacity:0.6,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-6,polygonOffsetUnits:-6});
let routeMesh=null;
function drawRoute(pts0){   // 連續嘅地面提示線：每 1.5 米一點，轉角用斜接，唔會斷開
  if(routeMesh){scene.remove(routeMesh);routeMesh.geometry.dispose();routeMesh=null;}
  const pts=[]; for(let i=0;i<pts0.length;i++){ const a=pts0[i]; if(i===0){ pts.push(a); continue; } const p=pts0[i-1], L=Math.hypot(a[0]-p[0],a[1]-p[1]); if(L<0.3) continue; const n=Math.max(1,Math.ceil(L/1.5)); for(let k=1;k<=n;k++) pts.push([p[0]+(a[0]-p[0])*k/n,p[1]+(a[1]-p[1])*k/n]); }
  if(pts.length<2) return; const hw=1.25, pos=[], idx=[];
  for(let i=0;i<pts.length;i++){ const a=pts[Math.max(0,i-1)], b=pts[Math.min(pts.length-1,i+1)]; let dx=b[0]-a[0], dz=b[1]-a[1], L=Math.hypot(dx,dz)||1; dx/=L; dz/=L;
    let m=1; if(i>0&&i<pts.length-1){ const p=pts[i-1],q=pts[i]; let ux=q[0]-p[0],uz=q[1]-p[1]; const ul=Math.hypot(ux,uz)||1; ux/=ul; uz/=ul; const cosv=ux*dx+uz*dz; m=Math.min(2,1/Math.max(0.5,cosv)); }
    const nx=-dz*hw*m, nz=dx*hw*m, p=pts[i], y=0.3+ELEV(p[0],p[1]); pos.push(p[0]+nx,y,p[1]+nz, p[0]-nx,y,p[1]-nz);
    if(i>0){ const k=i*2; idx.push(k-2,k-1,k, k-1,k+1,k); } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); routeMesh=new THREE.Mesh(g,routeMat); routeMesh.renderOrder=3; scene.add(routeMesh);
}
function routeAhead(){ const R=S.route; if(!R) return null; const pr=routeProj(); const c=S.car; if(!pr) return R.pts; const A=R.pts[pr.i-1],B=R.pts[pr.i]; const P=[A[0]+(B[0]-A[0])*pr.t,A[1]+(B[1]-A[1])*pr.t];
  return [[c.x,c.z],P,...R.pts.slice(pr.i)]; }   // 由車而家位置開始、已行過嘅部分唔畫
const ring=add(new THREE.TorusGeometry(5,0.45,12,48),M(0xff7a1a,{e:0x662200}),scene,0,0.5,0,false); ring.rotation.x=Math.PI/2; ring.visible=false;
const beacon=add(new THREE.CylinderGeometry(1.2,1.2,40,16,1,true),new THREE.MeshBasicMaterial({color:0xff7a1a,transparent:true,opacity:0.22,depthWrite:false,side:THREE.DoubleSide}),scene,0,20,0,false); beacon.visible=false;
const arrow=new THREE.Group(); arrow.visible=false;   // 舊浮動箭嘴已停用（唔再加入場景），改用路口藍色霓虹指示牌
{ const sh=(k)=>{ const g=new THREE.Shape(); g.moveTo(0,2.2*k); g.lineTo(1.7*k,0.2*k); g.lineTo(0.6*k,0.2*k); g.lineTo(0.6*k,-1.8*k); g.lineTo(-0.6*k,-1.8*k); g.lineTo(-0.6*k,0.2*k); g.lineTo(-1.7*k,0.2*k); g.closePath(); return g; };
  const tilt=new THREE.Group(); tilt.rotation.x=Math.PI/2-0.75; tilt.scale.setScalar(0.95); arrow.add(tilt); // 箭嘴指向前，斜向鏡頭
  const body=new THREE.Mesh(new THREE.ExtrudeGeometry(sh(1),{depth:0.35,bevelEnabled:false}),M(0xff7a1a,{e:0x662200})); tilt.add(body);
  const rim=new THREE.Mesh(new THREE.ShapeGeometry(sh(1.18)),new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide})); rim.position.z=0.175; tilt.add(rim);
  tilt.position.z=0.3; }

/* ---------- 轉彎路口：藍色霓虹「》」指示牌 ---------- */
const TURNS=(()=>{ const N=10, signs=[];
  const cv=document.createElement('canvas'); cv.width=256; cv.height=192; const g=cv.getContext('2d');
  g.fillStyle='#071426'; g.fillRect(0,0,256,192); g.strokeStyle='#1d6dff'; g.lineWidth=6; g.strokeRect(5,5,246,182);
  const chev=(x)=>{ g.beginPath(); g.moveTo(x,36); g.lineTo(x+52,96); g.lineTo(x,156); };
  g.lineCap='round'; g.lineJoin='round';
  [[30,'#2f7dff'],[14,'#7fb3ff'],[6,'#ffffff']].forEach(([w,c])=>{ g.strokeStyle=c; g.lineWidth=w; g.shadowColor='#3b8bff'; g.shadowBlur=w>20?28:10; chev(64); g.stroke(); chev(132); g.stroke(); });
  const tex=new THREE.CanvasTexture(cv); tex.anisotropy=4;
  const gc=document.createElement('canvas'); gc.width=gc.height=128; const gg=gc.getContext('2d'); const rg=gg.createRadialGradient(64,64,4,64,64,64); rg.addColorStop(0,'rgba(70,140,255,.9)'); rg.addColorStop(1,'rgba(70,140,255,0)'); gg.fillStyle=rg; gg.fillRect(0,0,128,128);
  const gtex=new THREE.CanvasTexture(gc);
  const flatG=new THREE.PlaneGeometry(3.6,2.7), boardG=new THREE.PlaneGeometry(2.2,1.65), glowG=new THREE.PlaneGeometry(4.4,3.4), postG=new THREE.CylinderGeometry(0.07,0.07,1.8,6);
  const postM=new THREE.MeshLambertMaterial({color:0x4a5260});
  for(let i=0;i<N;i++){ const grp=new THREE.Group(); const bm=new THREE.MeshBasicMaterial({map:tex,toneMapped:false,side:THREE.DoubleSide});
    const b=new THREE.Mesh(boardG,bm); b.position.y=2.6; grp.add(b);
    const gm=new THREE.MeshBasicMaterial({map:gtex,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,opacity:0.7});
    const gl=new THREE.Mesh(glowG,gm); gl.position.set(0,2.6,-0.05); grp.add(gl);
    const p=new THREE.Mesh(postG,postM); p.position.y=0.9; grp.add(p);
    const fm=new THREE.MeshBasicMaterial({map:tex,toneMapped:false,transparent:true,opacity:0.9,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-8,polygonOffsetUnits:-8});
    const fl=new THREE.Mesh(flatG,fm); fl.rotation.x=-Math.PI/2; fl.position.y=0.34; fl.renderOrder=4; grp.add(fl);
    grp.visible=false; scene.add(grp); signs.push({grp,b,bm,gm,gl,p,fl,fm,k:0}); }
  let T=0;
  function update(){ signs.forEach(z=>z.grp.visible=false); if(!S.route||S.mode!=='drive'||S.gm==='chase'||S.gm==='free') return;
    const P=routeAhead(); if(!P||P.length<3) return; let used=0, dist=0, turns=0;
    for(let i=1;i<P.length-1&&turns<2;i++){ const A=P[i-1],B=P[i],C=P[i+1]; let ux=B[0]-A[0],uz=B[1]-A[1]; const lu=Math.hypot(ux,uz); dist+=lu; if(dist>190) break;
      let vx=C[0]-B[0],vz=C[1]-B[1]; const lv=Math.hypot(vx,vz); if(lu<3||lv<6) continue; ux/=lu; uz/=lu; vx/=lv; vz/=lv;
      const ang=Math.atan2(ux*vz-uz*vx, ux*vx+uz*vz); if(Math.abs(ang)<0.6) continue;
      { let J=false; for(let q=0;q<NODES.length;q++){ if(DEG[q]>=3&&Math.hypot(NODES[q][0]-B[0],NODES[q][1]-B[1])<(NW[q]||6)+9){ J=true; break; } } if(!J) continue; }   // 只喺路口轉彎先擺，彎路唔擺
      const left=(vx*uz+vz*(-ux))>0;   // 左邊法線 (uz,-ux)
      // 搵轉入嗰條街嘅對面路邊：沿住行車方向行，直到轉入方向 10 米嗰點唔再係馬路
      let d=3; while(d<34&&(cellAt(B[0]+ux*d+vx*10,B[1]+uz*d+vz*10)&1)) d+=1;
      const n=Math.max(3,Math.min(5,Math.round(Math.abs(ang)/0.4)+2)), flat=d>=34; d+=1.2;
      for(let k=0;k<n&&used<N;k++,used++){ const z=signs[used]; z.b.visible=z.gl.visible=z.p.visible=!flat; z.fl.visible=flat;
        if(!flat){ const off=1.5+k*2.1;   // 沿住轉入方向排喺對面路邊，面向駛近嘅救護車
          z.grp.position.set(B[0]+ux*d+vx*off,ELEV(B[0],B[1]),B[1]+uz*d+vz*off); z.grp.rotation.y=Math.atan2(-ux,-uz); z.b.scale.x=left?-1:1; }
        else { const off=3.5+k*4;   // 搵唔到路邊（多叉路口）：改喺轉入嗰條路面畫發光「》」
          z.grp.position.set(B[0]+vx*off,ELEV(B[0]+vx*off,B[1]+vz*off),B[1]+vz*off); z.grp.rotation.y=Math.atan2(-vz,vx); }
        z.k=k; z.n=n; z.grp.visible=true; }
      turns++; } }
  function tick(dt,t){ T+=dt; if(T>0.3){ T=0; update(); } signs.forEach(z=>{ if(!z.grp.visible) return; const ph=((t*3)%(z.n+1.5)); const on=Math.abs(ph-z.k)<0.9; const f=on?1:0.45; z.bm.color.setScalar(f); z.gm.opacity=on?0.9:0.35; z.fm.opacity=on?0.95:0.5; }); }
  function hide(){ signs.forEach(z=>z.grp.visible=false); }
  return {update,tick,hide}; })();
function setTarget(xz){ S.arrowA=null; S.target=xz; ring.position.set(xz[0],0.5,xz[1]); beacon.position.set(xz[0],20,xz[1]); ring.visible=beacon.visible=arrow.visible=true; S.routeT=0; }
// 路線點：車位 → 路口 … → 目的地（略過車已經行過嘅第一個路口、目的地之後嘅最後一個路口）
function onSeg(px,pz,A,B){ const dx=B[0]-A[0],dz=B[1]-A[1],L2=dx*dx+dz*dz||1; const t=((px-A[0])*dx+(pz-A[1])*dz)/L2; const qx=A[0]+dx*t-px,qz=A[1]+dz*t-pz; return t>0&&t<1&&qx*qx+qz*qz<16*16; }
function refreshRoute(force){
  const c=S.car, T=S.target;
  const segCand=(x,z)=>{ const A=nearestNode(x,z); const out=[A]; ADJ[A].forEach(e=>{ if(onSeg(x,z,NODES[A],NODES[e[0]])) out.push(e[0]); }); return out; };
  // 起點：喺車後面嘅路口要掉頭，加罰分；終點：最後一段要令目的地喺左手邊（靠左行），否則加罰分
  const fx=Math.sin(c.a), fz=Math.cos(c.a); let best=null;
  // 未出救護站：先直駛出車房到馬路先計路線（唔好計條穿過車房嘅路）
  let sx=c.x, sz=c.z; if(!S.leftDepot&&S.step===1){ for(let d=4;d<60;d+=2){ const px=c.x+fx*d, pz=c.z+fz*d; if(cellAt(px,pz)&1){ sx=px+fx*3; sz=pz+fz*3; break; } } }
  const ends=segCand(T[0],T[1]), starts=segCand(sx,sz);
  const ban=CLOSED.map(r=>r.n); if(ends.length>1) ban.push(ends); if(starts.length>1) ban.push(starts); // 唔准喺起點／終點嗰段兜返轉頭
  for(const n of starts) for(const m of ends){ const r=route(n,m,ban); if(!r) continue;
    const N=NODES[n], E=NODES[m]; const dx=N[0]-sx, dz=N[1]-sz;
    const ex=T[0]-E[0], ez=T[1]-E[1], el=Math.hypot(ex,ez)||1; let side=1; { const o=ends.find(q=>q!==m); if(o!=null){ const O=NODES[o]; const [ux,uz]=dirn(E,O); side=ex*uz-ez*ux; } } // 正數 = 喺左手邊
    let cost=r.len+Math.hypot(dx,dz)+el+(dx*fx+dz*fz<-4?120:0)+(side<0?30:0);   // 救護車可以過對面線，唔使為咗靠左停而兜圈
    if(n===m&&starts.length>1&&ends.length>1&&starts.includes(ends[0])&&starts.includes(ends[1])) cost=Math.hypot(T[0]-c.x,T[1]-c.z)+((T[0]-c.x)*fx+(T[1]-c.z)*fz<0?400:0); // 同一段路
    if(!best||cost<best.cost) best={r,cost}; }
  { const dd=Math.hypot(T[0]-c.x,T[1]-c.z); let clear=dd<55; for(let k=0.05;clear&&k<1;k+=0.05) if(cellAt(c.x+(T[0]-c.x)*k,c.z+(T[1]-c.z)*k)&6) clear=false;   // 就到目的地：直接畫過去，唔再兜路
    if(clear&&(S.step!==1||S.leftDepot)){ const pts=[[c.x,c.z],T]; S.route={path:[],pts,len:dd,cum:[0,dd],idx:0}; drawRoute(pts); return; } }
  if(!best) return; const r=best.r; let path=r.path.slice();
  if(path.length>1&&onSeg(sx,sz,NODES[path[0]],NODES[path[1]])) path.shift();
  if(path.length>1&&onSeg(T[0],T[1],NODES[path[path.length-2]],NODES[path[path.length-1]])) path.pop();
  if(path.length===1&&onSeg(T[0],T[1],[c.x,c.z],NODES[path[0]])) path=[];
  const raw=[[c.x,c.z],...(sx!==c.x||sz!==c.z?[[sx,sz]]:[]),...path.map(i=>NODES[i]),T];
  // 靠左行（香港）：路口位置向左偏到行車線中間
  const lane=(p,q,i)=>{ const r=EDGE[path[i-2]+'-'+path[i-1]]; return r?laneOff(r):3.4; };
  const pts=[raw[0]];
  for(let i=1;i<raw.length-1;i++){ const p=raw[i], a=raw[i-1], q=raw[i+1];
    let d1=[p[0]-a[0],p[1]-a[1]], d2=[q[0]-p[0],q[1]-p[1]]; const l1=Math.hypot(...d1)||1, l2=Math.hypot(...d2)||1; d1=[d1[0]/l1,d1[1]/l1]; d2=[d2[0]/l2,d2[1]/l2];
    const n1=[d1[1],-d1[0]], n2=[d2[1],-d2[0]]; const o1=i>=2?lane(a,p,i):(i+1<raw.length-1?lane(p,q,i+1):3.4), o2=i+1<raw.length-1?lane(p,q,i+1):o1;
    const cr=d1[0]*d2[1]-d1[1]*d2[0], dot=d1[0]*d2[0]+d1[1]*d2[1];
    if(dot<-0.7){ pts.push([p[0]+n1[0]*o1,p[1]+n1[1]*o1]); pts.push([p[0]+n2[0]*o2,p[1]+n2[1]*o2]); }
    else if(Math.abs(cr)<0.08) pts.push([p[0]+(n1[0]*o1+n2[0]*o2)/2,p[1]+(n1[1]*o1+n2[1]*o2)/2]);
    else { // 兩條偏移線相交
      const P1=[p[0]+n1[0]*o1,p[1]+n1[1]*o1], P2=[p[0]+n2[0]*o2,p[1]+n2[1]*o2]; const tt=((P2[0]-P1[0])*d2[1]-(P2[1]-P1[1])*d2[0])/cr; pts.push([P1[0]+d1[0]*tt,P1[1]+d1[1]*tt]); } }
  pts.push(T);
  if(sx!==c.x||sz!==c.z) pts.splice(1,0,[sx,sz]);   // 直駛出車房先轉入行車線
  let len=0; for(let i=1;i<pts.length;i++) len+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);
  const cum=[0]; for(let i=1;i<pts.length;i++) cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  S.route={path:r.path,pts,len,cum,idx:0}; drawRoute(pts); if(NEON) NEON.rail.cutPath(pts);   // 路線要駛入車道／停車點：拆走擋路嘅欄杆
}
// 沿路線向前望 ahead 米，畀箭嘴指
// 車喺路線上嘅位置（只向前搵，唔會因為經過路口而跳返轉頭）
function routeProj(){ const c=S.car, R=S.route, P=R.pts; let best=null;
  for(let i=Math.max(1,R.idx);i<P.length&&i<R.idx+6;i++){ const A=P[i-1],B=P[i]; const dx=B[0]-A[0],dz=B[1]-A[1],L2=dx*dx+dz*dz||1;
    let t=((c.x-A[0])*dx+(c.z-A[1])*dz)/L2; t=Math.max(0,Math.min(1,t)); const d=Math.hypot(A[0]+dx*t-c.x,A[1]+dz*t-c.z);
    if(!best||d<best.d-0.5) best={i,t,d,s:R.cum[i-1]+Math.sqrt(L2)*t}; }
  if(best) R.idx=best.i; return best; }
function pointAt(s){ const R=S.route, P=R.pts; s=Math.min(s,R.len); let i=1; while(i<P.length-1&&R.cum[i]<s) i++;
  const A=P[i-1],B=P[i], L=R.cum[i]-R.cum[i-1]||1, k=(s-R.cum[i-1])/L; return [A[0]+(B[0]-A[0])*k,A[1]+(B[1]-A[1])*k]; }
function lookAhead(ahead){ const pr=routeProj(); if(!pr) return S.target; return pointAt(pr.s+ahead); }
/* ---------- UI ---------- */
function show(id,on){ $(id).classList.toggle('show',on); }
function hud(title,sub){ $('hTitle').textContent=title; $('hSub').textContent=sub; }
function caption(txt){ const el=$('cap'); if(!txt){el.classList.remove('show');return;} el.textContent=txt; el.classList.add('show'); }
let toastT=0; function toast(txt){ const el=$('toast'); el.textContent=txt; el.classList.add('show'); toastT=2.2; }
/* ---------- 流程 ---------- */
function dropModel(m){ scene.remove(m); m.traverse(o=>{ if(o.geometry&&!o.geometry.userData.shared) o.geometry.dispose(); }); }
function resetActors(){ clearScene();
  cars.forEach(c=>dropModel(c.m)); cars.length=0; peds.forEach(p=>scene.remove(p.m)); peds.length=0;
  crew.visible=false; scene.attach(patient); patient.visible=false; bystander.visible=false;
  amb.userData.doors.forEach(d=>d.rotation.y=0); amb.visible=true;
}
function startCase(i){
  ensureAudio(); chModeExit(); S.gm='ems'; sirenSet(false); if(S.simOn) SIM.end();
  const lv=LEVELS[i]; S.lvl=i; S.level=lv; const k=caseOf(lv); S.kase=k; S.kase.loc=LMK[k.poi]; { const Lc=S.kase.loc; if(NEON&&Lc&&Lc.stop&&Lc.patient) NEON.rail.cutPath([Lc.stop,Lc.patient],3); } DEPOT=DEPOTS[lv.depot||(REGION==='st'?'st':'tm')]; AE=HOSPS[DEF_H]; S.dest=DEF_H; { const fx=Math.sin(DEPOT.a), fz=Math.cos(DEPOT.a); cam.position.set(DEPOT.pos[0]+fx*34,12,DEPOT.pos[1]+fz*34); camLook.set(DEPOT.pos[0],2,DEPOT.pos[1]); }   // 鏡頭即刻去返今關救護站，唔好由另一區飛過嚟
  resetActors(); setTOD(lv.tod); clearEvents();
  const d=DEPOT.pos;
  Object.assign(S.car,{x:d[0],z:d[1],a:DEPOT.a,v:0}); S.camYaw=S.car.a;
  Object.assign(S,{yieldPass:0,mode:'drive',step:1,leftDepot:false,depotCam:false,sirenMuted:false,swingT:0,wasBay:false,sirenUsed:false,equipOk:false,quizOk:false,lives:5,onTime:0,overT:false,stab:100,stabLow:100,dashLeft:lv.dash,dashT:14+Math.random()*10,newAch:[],log:[],pedLast:-9,collided:false,redRun:false,inX:-1,quizOpen:false,qDone:[false,false,!k.triage],qScore:0,qPending:0,collisions:0,t0:performance.now()/1000,tScene:0,tHosp:0,lastHit:-9,tut:false,yieldScore:0});
  PLAY.radioClear(); PLAY.tutEnd(); PLAY.evReset(); if(S.tutPick){ S.tutPick=false; PLAY.tutStart(); }
  S.noCross=!!(lv.support||lv.escort); const carN=S.noCross?Math.round(lv.cars*0.6):lv.cars;   // 有其他車一齊出動：冇行人過馬路、路面車少啲，提升效能
  S.spawnFree=true; // 開局一次過擺好（之後先避開鏡頭）
  for(let n=0;n<carN;n++){ const c={m:carModel((GFX>=3?['taxi','car','bus','minibus','taxi','car','minibus','taxi','car']:['taxi','car','bus','car','minibus','taxi','car'])[n%(GFX>=3?9:7)])}; if(placeCar(c,d[0],d[1])) cars.push(c); else dropModel(c.m); }
  for(let n=0;n<PED_N;n++){ const p={m:pedModel()}; if(placePed(p,d[0],d[1])) peds.push(p); else scene.remove(p.m); }
  S.spawnFree=false; setupScene(k,lv);
  const L=k.loc; patient.visible=true; patient.position.set(L.patient[0],0.3,L.patient[1]); patient.rotation.set(0,Math.random()*6,0);
  patient.userData.blanket.visible=false; patient.userData.p.position.set(0,0.5,1.2); patient.userData.p.rotation.set(-Math.PI/2,0,0);
  bystander.visible=true; bystander.position.set(L.patient[0]+2,0.2,L.patient[1]+1.5);
  setTarget(L.stop); refreshRoute(true); startLeg(); S.escRoute=S.route?{pts:S.route.pts.map(p=>p.slice()),cum:S.route.cum.slice(),len:S.route.len}:null; // 其他救護車跟住呢條橙色線
  caption(null); show('menu',false); show('result',false); show('over',false); show('quiz',false); show('hudWrap',true); drawLives(); realBegin(!!S.realPick);
  hud(lv.id.replace('L','第 ')+' 關 · '+k.place,'① 出車 · '+k.title+' · '+lv.todName); $('call').textContent='控制中心：'+k.call; show('callBox',true); setTimeout(()=>show('callBox',false),4200);
  alarm();
}
function arriveScene(){
  S.mode='seq'; S.seq=0; S.step=2; S.tScene=performance.now()/1000-S.t0; endLeg(); S.car.v=0; ring.visible=beacon.visible=arrow.visible=false;
  if(routeMesh) routeMesh.visible=false;

  hud('任務：'+S.kase.place,'② 到場 · 救護員處理'); PLAY.radio('A188'+' 到場 '+S.kase.place+'，救護員處理中。','A188');
}
function toHospital(){
  AE=HOSPS[S.dest]||HOSPS[DEF_H]; S.mode='drive'; S.step=4; clearEvents(); setTarget(AE.stop); refreshRoute(true); if(routeMesh) routeMesh.visible=true; S.stab=100; S.stabLow=100; show('stabBox',true); startLeg();
  hud('送院：'+AE.name+'急症室','④ 送院 · 跟住橙色路線'); caption(null); PLAY.radio('A188'+' 病人已上車，而家送去'+AE.name+'急症室。','A188'); setTimeout(()=>{ if(S.step===4&&S.mode==='drive') PLAY.radio('收到 '+'A188'+'，'+AE.name+'急症室已經準備好接收。'); },5200);
  // 重新分佈車同行人到新位置附近
  // 只搬鏡頭睇唔到嘅車同行人（其他會喺行遠咗之後先自然重新分佈）
  cars.forEach(c=>{ if(!c.pose||!inView(c.pose.x,c.pose.z)) placeCar(c,S.car.x,S.car.z); }); peds.forEach(p=>{ if(!p.pos||!inView(p.pos[0],p.pos[1],4)) placePed(p,S.car.x,S.car.z); });
}
function arriveHospital(){ PLAY.radio('A188'+' 到達'+(AE.name||'')+'急症室，準備交接病人。','A188'); sirenSet(false); S.mode='hseq'; S.seq=0; S.step=5; S.tHosp=performance.now()/1000-S.t0; endLeg(); show('stabBox',false); clearEvents(); S.car.v=0; ring.visible=beacon.visible=arrow.visible=false; if(routeMesh) routeMesh.visible=false;
  hud(AE.name+'急症室','⑤ 交接病人'); }
function finish(){
  if(REAL.on&&S.gm==='ems'&&!REAL.ending){ realAVM(); return; }   // 寫實模式：交接完先 AVM 返站
  S.stars=S.lives; S.mode='result'; caption(null); sirenSet(false);
  const lv=S.level; if(!FUN.on&&!S.simOn){ saveBest(lv.id,S.stars); markDone(lv.id); }
  // 成就（歡樂模式唔計）
  if(!FUN.on){ ach('first'); if(S.lives===5) ach('perfect'); if(S.onTime>=2) ach('ontime'); if(S.stabLow>=85) ach('steady'); if(S.qScore>=2) ach('quiz');
  if(lv.tod==='night'||lv.tod==='rain') ach('night'); if(LEVELS.every(l=>isDone(l.id))) ach('all'); if(!S.redRun&&S.sirenUsed) ach('siren'); }
  $('rTitle').textContent=FUN.on?'🎉 歡樂模式完成（唔計成績）':'任務完成';
  $('rStars').innerHTML=[0,1,2,3,4].map(i=>'<span class="'+(i<S.stars?'on':'off')+'">'+lifeStar(34)+'</span>').join('');
  $('rTime').textContent='到場 '+fmt(S.tScene)+' · 送院完成 '+fmt(S.tHosp);
  const ex=[];
  ex.push((S.onTime>=2?'⏱️ 兩段都準時':'⏱️ 準時 '+S.onTime+' / 2 段'));
  ex.push('🛏️ 病人穩定度最低 '+Math.round(S.stabLow)+'%');
  if(!S.simOn) ex.push('🧰 裝備 '+(S.equipOk?'揀啱':'揀錯')+' · 小測 '+(S.quizOk?'答啱':'答錯'));
  if(FUN.on) ex.push('🎉 歡樂分 '+FUN.score.toLocaleString());
  if(REAL.on) ex.push('🏅 今更完成 '+REAL.jobs+' 單 · 得分 '+REAL.shift.toLocaleString()+' · 累積總分 '+REAL.cash.toLocaleString());
  if(S.simOn&&SIM.summary) ex.unshift(SIM.summary);
  if(S.yieldPass) ex.push('🚑 順利越過讓路車 '+S.yieldPass+' 架'); if((S.yieldPass||0)>=5) ach('yield');
  $('rNote').innerHTML=(S.lives===5?'完美！全程冇犯錯。':'扣咗 '+(5-S.lives)+' 粒：'+S.log.join('、'))+'<br><small>'+ex.join(' · ')+'</small>';
  $('rAch').innerHTML=S.newAch.length?'<b>🏆 新成就：</b>'+S.newAch.map(a=>ACH[a].name).join('、'):'';
  const nx=S.simOn?null:LEVELS[S.lvl+1]; $('rNext').style.display=nx?'block':'none'; if(nx) $('rNext').textContent='下一關：'+caseOf(nx).place+'（'+nx.todName+'）';
  $('rTips').innerHTML='<b>📗 已收集知識卡：'+S.kase.title+'</b><ul>'+S.kase.tips.map(t=>'<li>'+t+'</li>').join('')+'</ul>';
  $('rName').value=getName(); $('rSave').disabled=false; $('rSave').textContent='儲存到排行榜';
  PLAY.chalResult(); if(S.tut){ store.set('tutDone',1); $('rTitle').textContent='🎓 新手教學完成！'; } PLAY.tutEnd(); S.tut=false;
  show('result',true); show('hudWrap',false); checkLiveryUnlock(); fireworks(S.stars);
}
/* ---------- 任務完成：按剩低幾多粒生命之星放煙花（5 粒最多，0 粒冇） ---------- */
let FW=null;
function fireworks(n){ const cv=$('fw'); if(FW){ cancelAnimationFrame(FW.raf); FW=null; } const g=cv.getContext('2d'); const W=cv.width=innerWidth*Math.min(2,devicePixelRatio||1), H=cv.height=innerHeight*Math.min(2,devicePixelRatio||1);
  g.clearRect(0,0,W,H); if(!n||n<1||matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const total=[0,2,4,7,11,18][Math.min(5,n)], dur=1.2+total*0.32, cols=['#ff4d6d','#ffd166','#06d6a0','#4cc9f0','#f72585','#ffffff','#ff9f1c'];
  const shots=[...Array(total)].map((_,i)=>({t:i*(dur/total)*0.9+Math.random()*0.2,x:W*(0.15+Math.random()*0.7),y:H*(0.12+Math.random()*0.35),c:cols[Math.random()*cols.length|0],big:n===5&&i%4===0,done:false}));
  const parts=[]; const t0=performance.now(); FW={raf:0};
  const pop=()=>{ try{ ensureAudio(); if(!actx) return; const o=actx.createOscillator(), gg=actx.createGain(); o.type='triangle'; o.frequency.setValueAtTime(380+Math.random()*200,actx.currentTime); o.frequency.exponentialRampToValueAtTime(90,actx.currentTime+0.25); gg.gain.value=0.025; gg.gain.exponentialRampToValueAtTime(0.0001,actx.currentTime+0.3); o.connect(gg); gg.connect(master); o.start(); o.stop(actx.currentTime+0.3); }catch(e){} };
  const step=()=>{ const t=(performance.now()-t0)/1000; g.globalCompositeOperation='source-over'; g.fillStyle='rgba(0,0,0,0)'; g.clearRect(0,0,W,H);
    shots.forEach(s=>{ if(!s.done&&t>=s.t){ s.done=true; pop(); const k=s.big?90:48, sp=(s.big?7:5)*(W/800+0.6);
      for(let i=0;i<k;i++){ const a=i/k*Math.PI*2+Math.random()*0.1, v=sp*(0.6+Math.random()*0.5); parts.push({x:s.x,y:s.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:1,c:Math.random()<0.2?'#ffffff':s.c,heart:s.big&&i%6===0}); } } });
    g.globalCompositeOperation='lighter';
    for(let i=parts.length-1;i>=0;i--){ const p=parts[i]; p.x+=p.vx; p.y+=p.vy; p.vy+=0.06*(W/800+0.6); p.vx*=0.985; p.vy*=0.985; p.life-=0.012; if(p.life<=0){ parts.splice(i,1); continue; }
      g.globalAlpha=Math.max(0,p.life); g.fillStyle=p.c; if(p.heart){ g.font=(14*(W/800+0.6))+'px sans-serif'; g.fillText('✱',p.x,p.y); } else { g.beginPath(); g.arc(p.x,p.y,2.2*(W/800+0.6),0,7); g.fill(); } }
    g.globalAlpha=1; if(t<dur+3||parts.length) FW.raf=requestAnimationFrame(step); else g.clearRect(0,0,W,H); };
  FW.raf=requestAnimationFrame(step); }
function stopFireworks(){ if(FW){ cancelAnimationFrame(FW.raf); FW=null; } const cv=$('fw'); cv.getContext('2d').clearRect(0,0,cv.width,cv.height); }
/* ---------- 生命之星：做錯一樣扣一粒，扣晒就遊戲結束 ---------- */
function lifeStar(sz){ return '<svg class="lstar" viewBox="-12 -12 24 24" width="'+sz+'" height="'+sz+'" aria-hidden="true"><g fill="currentColor" stroke="#fff" stroke-width="1.3"><rect x="-3.2" y="-11" width="6.4" height="22" rx="1"/><rect x="-3.2" y="-11" width="6.4" height="22" rx="1" transform="rotate(60)"/><rect x="-3.2" y="-11" width="6.4" height="22" rx="1" transform="rotate(-60)"/></g><path d="M0-7V7" stroke="#fff" stroke-width="1.5"/><path d="M-1.6-4.5q3.2 1.3 0 2.6t0 2.6t0 2.6" fill="none" stroke="#fff" stroke-width="1"/></svg>'; }
function drawLives(lost){ $('lives').innerHTML=[0,1,2,3,4].map(i=>'<span class="'+(i<S.lives?'on':'off')+(i===lost?' lost':'')+'" style="animation-delay:'+(i*0.12)+'s">'+lifeStar(18)+'</span>').join(''); $('lives').setAttribute('aria-label','生命之星 '+S.lives+' / 5'); }
function loseLife(why,msg){ if(FUN.on) return; if(S.tut){ toast('教學提示：'+msg+'（教學模式唔扣生命之星）'); return; } if(S.gm&&S.gm!=='ems') return; if(S.lives<=0) return; S.lives--; S.log.push(why); drawLives(S.lives); toast(msg+'  −1 生命之星');
  const el=$('lives'); el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
  if(S.lives<=0) setTimeout(()=>gameOver(why),700); }
function gameOver(why){ if(S.mode==='result') return; S.mode='over'; S.car.v=0; sirenSet(false); show('quiz',false); S.quizOpen=false; S.sirenMuted=false;
  $('oWhy').textContent='最後一次犯錯：'+why+'。'; $('oStars').innerHTML=[0,1,2,3,4].map(()=>'<span class="off">'+lifeStar(34)+'</span>').join(''); show('over',true); show('hudWrap',false); }
const fmt=s=>{s=Math.max(0,Math.round(s)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};

/* ---------- 輸入 ---------- */
function bindHold(id,key){ const b=$(id); const on=e=>{e.preventDefault();S.hold[key]=true;b.classList.add('on')}, off=()=>{S.hold[key]=false;b.classList.remove('on')};
  b.addEventListener('pointerdown',on); ['pointerup','pointercancel','pointerleave'].forEach(ev=>b.addEventListener(ev,off)); }
bindHold('bL','L'); bindHold('bR','R'); bindHold('bG','G'); bindHold('bB','B');
// 鍵盤：方向鍵或者 WASD（W 上＝油、A 左、S 下＝倒、D 右）；用 e.code，大楷、中文輸入法都照用
const KEYS={ArrowLeft:'L',ArrowRight:'R',ArrowUp:'G',ArrowDown:'B',KeyA:'L',KeyD:'R',KeyW:'G',KeyS:'B'};
const typing=e=>{ const t=e.target; return t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable); };
addEventListener('keydown',e=>{ if(typing(e)) return; const k=KEYS[e.code]||KEYS[e.key]; if(k){ S.hold[k]=true; e.preventDefault(); } if(e.code==='KeyH'&&!e.repeat) $('bH').click(); });
addEventListener('keyup',e=>{ const k=KEYS[e.code]||KEYS[e.key]; if(k) S.hold[k]=false; });
addEventListener('blur',()=>{ S.hold.L=S.hold.R=S.hold.G=S.hold.B=false; });
// 滑鼠（或手指）拉動畫面旋轉鏡頭：左右拉轉方向、上下拉改高低；放手兩秒後慢慢轉返車後面
S.camDrag={yaw:0,pitch:0,on:false,x:0,y:0,t:0};
R.domElement.style.touchAction='none';
R.domElement.addEventListener('pointerdown',e=>{ const D=S.camDrag; D.on=true; D.x=e.clientX; D.y=e.clientY; D.id=e.pointerId; try{ R.domElement.setPointerCapture(e.pointerId); }catch(_){} R.domElement.style.cursor='grabbing'; });
R.domElement.addEventListener('pointermove',e=>{ const D=S.camDrag; if(!D.on||e.pointerId!==D.id) return; D.yaw-=(e.clientX-D.x)*0.008; D.pitch=Math.max(-0.5,Math.min(1,D.pitch+(e.clientY-D.y)*0.006)); D.x=e.clientX; D.y=e.clientY; D.t=performance.now(); });
['pointerup','pointercancel'].forEach(ev=>R.domElement.addEventListener(ev,e=>{ const D=S.camDrag; D.on=false; D.t=performance.now(); R.domElement.style.cursor='grab'; }));
R.domElement.style.cursor='grab';
function camDragTick(dt){ const D=S.camDrag; if(S.simOn&&document.body.classList.contains('simScene')) return; if(!D.on&&performance.now()-D.t>2000){ const k=Math.min(1,dt*2); D.yaw-=D.yaw*k; D.pitch-=D.pitch*k; } }
$('bH').addEventListener('click',()=>{ if(!VSPEC.siren){ horn(); return; } sirenSet(!S.siren); if(S.siren) S.sirenUsed=true; });
$('rAgain').onclick=()=>{ stopFireworks(); if(S.simOn){ SIM.again(); return; } S.gm==='cpr'?startCPR(CP.mode,CP.breaths):S.gm==='taxi'?startTaxi():S.gm==='chase'?startChase():startCase(S.lvl); }; $('rNext').onclick=()=>{ stopFireworks(); startCase(S.lvl+1); }; $('rMenu').onclick=()=>{ stopFireworks(); show('result',false);toMenu();};
$('oAgain').onclick=()=>S.gm==='taxi'?startTaxi():S.gm==='chase'?startChase():startCase(S.lvl); $('oMenu').onclick=()=>{show('over',false);toMenu();};
$('bMenu').onclick=()=>{ sirenSet(false); toMenu(); };
function toMenu(){ if(S.simOn) SIM.end(); KIT.visible=false; PLAY.radioClear(); PLAY.tutEnd(); S.tut=false; realBegin(false); S.realPick=false; S.pcPick=false; chModeExit(); clearEvents(); setTOD('day'); show('stabBox',false); show('quiz',false); S.quizOpen=false; S.sirenMuted=false; S.mode='menu'; resetActors(); ring.visible=beacon.visible=arrow.visible=false; if(routeMesh) routeMesh.visible=false; caption(null); show('hudWrap',false); renderMenu(); show('menu',true); }

/* ---------- 聲音：警號（撳一下開／關）、出車鐘聲 ---------- */
let actx=null, osc=null, gain=null, sirenTimer=null;
let master=null;
function ensureAudio(){ try{ if(!actx){ actx=new (window.AudioContext||window.webkitAudioContext)(); master=actx.createGain(); master.gain.value=1; master.connect(actx.destination);
      // iOS 解鎖：喺第一次撳嘅時候播一段無聲音訊
      const b=actx.createBuffer(1,1,22050), src=actx.createBufferSource(); src.buffer=b; src.connect(master); src.start(0); }
    if(actx.state!=='running') actx.resume(); initFx(); }catch(e){} }
// 每次撳畫面都確保聲音開咗（有啲瀏覽器會自動暫停音訊）
['pointerdown','touchend','click','keydown'].forEach(ev=>addEventListener(ev,()=>{ if(actx&&actx.state!=='running'){ try{ actx.resume(); }catch(e){} } },{passive:true}));
// 引擎聲（鋸齒波＋低通）同倒車嗶嗶聲，音量都細過警號（0.04）
let eng=null, rev=null;
function initFx(){ if(eng||!actx) return;
  const o=actx.createOscillator(), o2=actx.createOscillator(), f=actx.createBiquadFilter(), g=actx.createGain(); o.type='sawtooth'; o2.type='square'; o2.detune.value=-1200;
  f.type='lowpass'; f.frequency.value=420; g.gain.value=0; o.connect(f); o2.connect(f); f.connect(g); g.connect(master); o.start(); o2.start(); eng={o,o2,f,g};
  const r=actx.createOscillator(), rg=actx.createGain(); r.type='square'; r.frequency.value=1150; rg.gain.value=0; r.connect(rg); rg.connect(master); r.start(); rev={o:r,g:rg}; }
function audioTick(t){ if(!eng) return; const c=S.car, now=actx.currentTime, driving=S.mode==='drive';
  const gas=driving&&S.hold.G&&!S.hold.B; const v=Math.abs(c.v);
  eng.o.frequency.setTargetAtTime(48+v*4.2,now,0.08); eng.o2.frequency.setTargetAtTime(48+v*4.2,now,0.08); eng.f.frequency.setTargetAtTime(300+v*22,now,0.1);
  eng.g.gain.setTargetAtTime(gas?0.03:(driving&&v>1?0.012:0),now,gas?0.05:0.25);
  const back=driving&&((S.hold.B&&c.v<=0.5&&!DRV.real)||c.v<-0.3||(DRV.real&&DRV.gear==='R'&&S.hold.G)); const beep=back&&(t*2.4%1)<0.5;
  rev.g.gain.setTargetAtTime(beep?0.025:0,now,0.01); }
function horn(){ ensureAudio(); if(!actx) return; try{ [0,0.22].forEach(d=>{ [392,494].forEach(f=>{ const o=actx.createOscillator(), g=actx.createGain(); o.type='sawtooth'; o.frequency.value=f*(VSPEC.kind==='bus'?0.62:1); g.gain.value=0.02; o.connect(g); g.connect(master); o.start(actx.currentTime+d); o.stop(actx.currentTime+d+0.16); }); }); }catch(e){} }
function sirenSet(on){ if(on&&!VSPEC.siren) on=false; S.siren=on; $('bH').classList.toggle('siren',on); $('bH').setAttribute('aria-pressed',on);
  if(on){ ensureAudio(); if(!actx||osc) return; osc=actx.createOscillator(); gain=actx.createGain(); osc.type='triangle'; gain.gain.value=0.0001; osc.connect(gain); gain.connect(master); osc.start();
    gain.gain.exponentialRampToValueAtTime(S.sirenMuted?0.0001:0.04,actx.currentTime+0.05); let hi=true; const step=()=>{ if(osc){osc.frequency.setValueAtTime(hi?VSPEC.tone[0]:VSPEC.tone[1],actx.currentTime); hi=!hi;} }; step(); sirenTimer=setInterval(step,VSPEC.tone[2]); }
  else { clearInterval(sirenTimer); if(gain&&actx){ gain.gain.exponentialRampToValueAtTime(0.0001,actx.currentTime+0.08); const o=osc; setTimeout(()=>{try{o.stop()}catch(e){}},120);} osc=null; gain=null; } }
// 答問題時警號聲暫時靜音（閃燈同讓路照舊），答完自動回復
function sirenMute(m){ S.sirenMuted=m; if(!gain||!actx) return; try{ gain.gain.cancelScheduledValues(actx.currentTime); gain.gain.setTargetAtTime(m?0.0001:0.04,actx.currentTime,0.06); }catch(e){} }
function alarm(){ if(!actx) return; try{ for(let i=0;i<6;i++){ const o=actx.createOscillator(),g=actx.createGain(); o.type='square'; o.frequency.value=1200; g.gain.value=0.04;
  o.connect(g); g.connect(master); o.start(actx.currentTime+i*0.25); o.stop(actx.currentTime+i*0.25+0.12); } }catch(e){} }
document.addEventListener('visibilitychange',()=>{ try{ if(master) master.gain.setTargetAtTime(document.hidden?0:1,actx.currentTime,0.05); if(!document.hidden&&actx&&actx.state!=='running') actx.resume(); }catch(e){} if(document.hidden&&S.siren){ const was=true; sirenSet(false); S._resume=was; } else if(!document.hidden&&S._resume){ S._resume=false; if(S.mode==='drive') sirenSet(true); } });

/* ---------- 小地圖 ---------- */
const MM=document.createElement('canvas'); const MMS=0.35; MM.width=Math.ceil((BX1-BX0+120)*MMS); MM.height=Math.ceil((BZ1-BZ0+120)*MMS);
{ const g=MM.getContext('2d'); g.fillStyle='#eef2e8'; g.fillRect(0,0,MM.width,MM.height); const T=([x,z])=>[(x-BX0+60)*MMS,(z-BZ0+60)*MMS];
  g.fillStyle='#bfe6a8'; MAP.parks.forEach(p=>{g.beginPath();p.forEach((q,i)=>{const [a,b]=T(q);i?g.lineTo(a,b):g.moveTo(a,b)});g.fill();});
  g.fillStyle='#8fd0f2'; MAP.water.forEach(p=>{g.beginPath();p.forEach((q,i)=>{const [a,b]=T(q);i?g.lineTo(a,b):g.moveTo(a,b)});g.fill();});
  g.strokeStyle='#9aa1ad'; g.lineCap='round'; MAP.roads.forEach(r=>{ g.lineWidth=Math.max(1.5,r.w*MMS); g.beginPath(); r.n.forEach((i,k)=>{const [a,b]=T(NODES[i]); k?g.lineTo(a,b):g.moveTo(a,b)}); g.stroke(); });
  g.fillStyle='#d8dee6'; MAP.blds.forEach(b=>{ g.fillStyle=b.lm?'#ffb07a':'#d8dee6'; g.beginPath(); b.p.forEach((q,i)=>{const [a,c]=T(q);i?g.lineTo(a,c):g.moveTo(a,c)}); g.fill(); }); }
const mmc=$('mini'), mg=mmc.getContext('2d');
function drawMini(){
  const W=mmc.width, Hh=mmc.height, c=S.car, sc=2.0; mg.save(); mg.clearRect(0,0,W,Hh);
  mg.beginPath(); mg.arc(W/2,Hh/2,W/2-2,0,Math.PI*2); mg.clip(); mg.fillStyle='#eef2e8'; mg.fillRect(0,0,W,Hh);
  mg.translate(W/2,Hh/2); mg.rotate(Math.PI+c.a); mg.scale(sc,sc);
  mg.drawImage(MM,-(c.x-BX0+60)*MMS,-(c.z-BZ0+60)*MMS);
  if(S.route&&S.mode==='drive'){ const RP=routeAhead()||[]; mg.strokeStyle='#ff7a1a'; mg.lineWidth=3/sc; mg.lineJoin=mg.lineCap='round'; mg.beginPath(); mg.moveTo(0,0); RP.forEach((n,k)=>{ if(k) mg.lineTo((n[0]-c.x)*MMS,(n[1]-c.z)*MMS)}); mg.stroke(); }
  if(S.gm==='chase') CH.cops.forEach(p=>{ mg.fillStyle=(Math.floor(performance.now()/250)%2)?'#1f4fbf':'#e8323c'; mg.beginPath(); mg.arc((p.x-c.x)*MMS,(p.z-c.z)*MMS,5/sc,0,Math.PI*2); mg.fill(); });
  if(S.gm==='taxi') TX.wait.forEach(w=>{ mg.fillStyle=TX.cls[w.k].css; mg.beginPath(); mg.arc((w.s.p[0]-c.x)*MMS,(w.s.p[1]-c.z)*MMS,5/sc,0,Math.PI*2); mg.fill(); });
  if(S.target){ mg.fillStyle='#e8323c'; mg.beginPath(); mg.arc((S.target[0]-c.x)*MMS,(S.target[1]-c.z)*MMS,4/sc,0,Math.PI*2); mg.fill(); }
  mg.restore(); mg.fillStyle='#1f4fbf'; mg.beginPath(); mg.moveTo(W/2,Hh/2-8); mg.lineTo(W/2+6,Hh/2+6); mg.lineTo(W/2-6,Hh/2+6); mg.fill();
  mg.strokeStyle='#fff'; mg.lineWidth=3; mg.beginPath(); mg.arc(W/2,Hh/2,W/2-2,0,Math.PI*2); mg.stroke();
}

/* ---------- 碰撞 ---------- */
function ambCircles(x,z,a){ const ux=Math.sin(a),uz=Math.cos(a); return VSPEC.circ.map(o=>[x+ux*o,z+uz*o]); }
function hitBuilding(x,z,a){ const ux=Math.sin(a),uz=Math.cos(a), rx=uz, rz=-ux;
  // 喺高架路上面：下面嘅樓／河唔計（以前會變成空氣牆）；車身中間仲喺馬路上（例如過橋）：只計建築物，唔計橋邊嘅河
  if(ELEV(x,z)>2) return false; const mask=(cellAt(x,z)&1)?2:6;
  for(const o0 of [-3,-1,1,3]) for(const s0 of [-1.1,1.1]){ const o=o0*VSPEC.kl, s=s0*VSPEC.kw; if(blockedAt(x+ux*o+rx*s,z+uz*o+rz*s,mask)) return true; } return false; }
function vib(ms){ try{ if(navigator.vibrate) navigator.vibrate(ms); }catch(e){} }
function bump(why){ const now=performance.now()/1000; S.collided=true; if(REAL.on) REAL.stress+=12; if(now-(S.lastShake||0)>0.4){ S.lastShake=now; S.shake=0.45; vib(60); } if(now-S.lastHit>2.5){ S.collisions++; S.lastHit=now; loseLife(why,why+'！'); } }

/* ---------- 主迴圈 ---------- */
function clampCam(want,look,sim){
  // 鏡頭同目標之間有建築物：拉近並升高，避免被樓宇遮住
  const dx=want.x-look.x, dz=want.z-look.z; let f=1;
  for(let k=0.08;k<=1.0;k+=0.04){ if(cellAt(look.x+dx*k,look.z+dz*k)&2){ f=k; break; } }
  if(f<1){ if(sim){ const k=Math.max(0.12,f-0.06); want.x=look.x+dx*k; want.z=look.z+dz*k; want.y=Math.max(3.2,Math.min(want.y,want.y*0.55+2.5)); return want; } const k=Math.max(0.22,f-0.08); want.x=look.x+dx*k; want.z=look.z+dz*k; want.y=Math.max(want.y,44); }
  return want;
}

const clock=new THREE.Clock(); const camLook=new THREE.Vector3(); const lerp=(a,b,t)=>a+(b-a)*Math.min(1,Math.max(0,t));
function walk(g,t,on,ph=0){ const k=on&&!reduce?Math.sin(t*9+ph):0; g.userData.legL.rotation.x=k*0.5; g.userData.legR.rotation.x=-k*0.5; }
let FOV0=55; function resize(){ const w=innerWidth,h=innerHeight; R.setSize(w,h); cam.aspect=w/h; cam.fov=FOV0=w<h?64:52; cam.updateProjectionMatrix(); }
addEventListener('resize',resize); resize();
/* 自動解像度：掉 frame 就逐步降低解像度，順返先升返；降咗之後陰影改為隔格更新 */
const DRES=(()=>{ const base=R.getPixelRatio(), min=Math.max(0.6,base*0.55); let r=base, n=0, t0=performance.now(), good=0;
  const apply=()=>{ R.setPixelRatio(r); if(REAL.comp&&REAL.comp.setPixelRatio) REAL.comp.setPixelRatio(r); R.shadowMap.autoUpdate=r>=base-0.01; };
  return { get atMin(){ return r<=min+0.01; }, get ratio(){ return r; }, tick(){ n++; if(!R.shadowMap.autoUpdate) R.shadowMap.needsUpdate=(n%2===0);
    const now=performance.now(); if(now-t0<1200) return; const fps=n*1000/(now-t0); n=0; t0=now; if(S.mode!=='drive'||document.hidden) return;
    if(fps<42&&r>min){ r=Math.max(min,r-0.12); good=0; apply(); } else if(fps>57){ if(++good>=3&&r<base){ r=Math.min(base,r+0.06); good=0; apply(); } } else good=0; } }; })();
const SGLOW=(()=>{ const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d'); const rg=g.createRadialGradient(64,64,4,64,64,64); rg.addColorStop(0,'rgba(255,255,255,.9)'); rg.addColorStop(0.45,'rgba(255,255,255,.35)'); rg.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=rg; g.fillRect(0,0,128,128);
  const mat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,color:0x3a7bff,polygonOffset:true,polygonOffsetFactor:-5,polygonOffsetUnits:-5});
  const m=new THREE.Mesh(new THREE.PlaneGeometry(15,15),mat); m.rotation.x=-Math.PI/2; m.renderOrder=3; m.visible=false; scene.add(m);
  return { tick(lit,on,t){ m.visible=!!lit&&S.mode!=='menu'; if(!m.visible) return; const c=S.car; m.position.set(c.x+Math.sin(c.a)*-0.5,0.32+ELEV(c.x,c.z),c.z+Math.cos(c.a)*-0.5);
    mat.color.setHex(0x2f6bff); mat.opacity=(CARL.night?0.75:0.28)*(on?1:0.35); } }; })();   // 警號藍燈照地面（只有藍光，跟閃燈節奏）
function tick(){
  let dt=Math.min(0.05,clock.getDelta()); const t=clock.elapsedTime; const c=S.car, U=amb.userData; dt=funTime(dt);   // 歡樂模式慢鏡
  if(S.mode==='map'){ VIEW.pre(); if(REAL.on) realRender(t); else R.render(scene,cam); requestAnimationFrame(tick); return; }   // 大地圖：暫停
  // 閃燈：出勤期間長開
  const on=Math.floor(t*5)%2===0, lit=S.siren; // 閃燈跟警號一齊開關
  CURL.forEach((b,i)=>b.material.emissive.setHex(lit&&((i%2===0)===on)?(b.userData.on||0x1550ff):0)); U.pB.intensity=lit&&on?1.4:0; U.pR.intensity=lit&&!on?1.4:0;
  if(FUN.on&&lit) CURL.forEach((b,i)=>{ if(b.material.emissive.getHex()) b.material.emissive.setHSL((t*0.9+i*0.17)%1,1,0.55); });   // 七彩警號燈
  // 煞車燈、轉向燈（跟轉彎方向閃）、警號紅藍光照落地面
  if(U.LT){ const H=S.hold, braking=S.mode==='drive'&&(H.B||(c.v>2&&!H.G)), st=S.mode==='drive'?DRV.sgn:0, bl=Math.floor(t*3.2)%2===0;
    U.LT.tail.forEach(m=>m.material.emissive.setHex(braking?0xff2020:(CARL.night?0x6a0000:0x400000)));
    [-1,1].forEach(sd=>U.LT.ind[sd].forEach(m=>m.material.emissive.setHex(st===sd&&Math.abs(c.v)>0.5&&bl?0xffa000:0x402000))); }
  SGLOW.tick(lit,on,t);
  if(U.FL){ const n=!!CARL.night&&S.mode!=='menu'; if(U.FL.on!==n){ U.FL.on=n; U.FL.glow.forEach(q=>q.visible=n); U.FL.mat.emissive.setHex(n?0xffffff:0); } }   // 夜間白色照明射燈
  if(S.mode==='cpr') cprTick(dt,t);
  if(S.mode==='drive'&&S.gm==='free'&&FRE.onFoot) freeTick(dt,t); else if(S.mode==='drive'){
    const H=DRV.input(dt,t), steer=H.steer;
    const nitro=FUN.on&&S.hold.N, onRoad=(cellAt(c.x,c.z)&1)||FUN.on, vmax=(onRoad?(FUN.on?Math.max(VSPEC.vmax,38):VSPEC.vmax):12)*(nitro?1.6:1), AK=(FUN.on?Math.max(VSPEC.acc,1.35):VSPEC.acc)*(nitro?2.2:1);   // 歡樂模式：全車解放、上行人路唔減速、🚀 氮氣
    if(H.G&&!H.B) c.v=Math.min(vmax,c.v+(c.v<0?34:(c.v<12?26:17)*AK)*dt); else if(H.B&&!H.G) c.v=Math.max(-7,c.v-(c.v>0?34:14)*dt);
    else c.v=c.v>0?Math.max(0,c.v-(S.wet?9:14)*dt):Math.min(0,c.v+(S.wet?9:14)*dt);
    if(c.v>vmax) c.v=Math.max(vmax,c.v-20*dt);
    DRV.post();
    if(!FUN.on) aebTick(dt);
    c.a+=steer*dt*VSPEC.steer*(S.wet?0.82:1)*Math.min(1,Math.abs(c.v)/5+0.35)*(c.v<-0.1?-1:1); stabilityTick(dt,steer);
    const nx=c.x+Math.sin(c.a)*c.v*dt, nz=c.z+Math.cos(c.a)*c.v*dt;
    if(hitBuilding(nx,nz,c.a)){ if(Math.abs(c.v)>3){ bump('撞到建築物'); stabHit(14); } c.v=-c.v*0.25; } else { c.x=nx; c.z=nz; }
    // 同車碰撞
    const AC=ambCircles(c.x,c.z,c.a);
    for(const k of [...cars,...trams,...ESC]){ if(!k.pose) continue; const dx=k.pose.x-c.x, dz=k.pose.z-c.z; const half=(k.m.userData.len||4)/2; if(dx*dx+dz*dz>(half+6)**2) continue;
      const kx=Math.sin(k.pose.a), kz=Math.cos(k.pose.a);
      for(const q of AC){ const pr=Math.max(-half+1.3,Math.min(half-1.3,(q[0]-k.pose.x)*kx+(q[1]-k.pose.z)*kz)); const ex=k.pose.x+kx*pr-q[0], ez=k.pose.z+kz*pr-q[1]; if(ex*ex+ez*ez<3.0*3.0){ if(FUN.on&&cars.includes(k)&&funHitCar(k,c)) break; if(Math.abs(c.v)>2) bump('撞到車'); if(Math.abs(c.v)>2) stabHit(14); c.v=-c.v*0.3; const L=Math.hypot(ex,ez)||1; c.x-=ex/L*0.6; c.z-=ez/L*0.6; k.hit=1.5; k.yHit=true; break; } } }
    // 撞到行人 → 扣一粒心；同一個行人已經跌低咗就唔會再扣
    // 行人自動避開：救護車前面幾米有人就跳開（歡樂模式除外）
    if(DODGE.on&&!FUN.on&&Math.abs(c.v)>1.5){ const fx=Math.sin(c.a),fz=Math.cos(c.a),sg=Math.sign(c.v); for(const p of peds){ if(!p.pos||p.mode==='fly'||p.mode==='down'||p.mode==='jump') continue; const dx=p.pos[0]-c.x, dz=p.pos[1]-c.z, ah=(dx*fx+dz*fz)*sg, lat=dx*fz-dz*fx; if(ah>-1&&ah<VSPEC.kl*3.2+2+Math.abs(c.v)*0.3&&Math.abs(lat)<VSPEC.kw*1.3+1.2) pedDodge(p,c,lat); } }
    for(const p of peds){ if(!p.pos) continue; for(const q of AC){ const ex=p.pos[0]-q[0], ez=p.pos[1]-q[1]; if(ex*ex+ez*ez<1.7*1.7&&Math.abs(c.v)>1.2&&p.mode!=='fly'&&p.mode!=='down'&&p.mode!=='jump'){ if(FUN.on){ funHitPed(p,c); break; } if(DODGE.on){ pedDodge(p,c,(p.pos[0]-c.x)*Math.cos(c.a)-(p.pos[1]-c.z)*Math.sin(c.a)); break; } if(S.gm!=='ems'){ pedFly(p,c); break; } c.v=0; p.mode='down'; p.downT=2.5; p.m.rotation.set(-Math.PI/2,p.m.rotation.y,0); loseLife('撞到行人','不能傷害市民！'); break; } } if(S.mode!=='drive') break; }
    U.wheels.forEach(w=>w.rotation.x+=c.v*dt/0.6);
    // 過路口：冇開警號衝紅燈要扣分
    { let inX=-1; for(let kk=0;kk<NODES.length;kk++){ if(SIGNAL[kk]&&Math.hypot(NODES[kk][0]-c.x,NODES[kk][1]-c.z)<CLR[kk]-1.5){ inX=kk; break; } }
      if(inX>=0&&inX!==S.inX&&c.v>2){ const st=lightState(inX,c.a,t);
        if(st==='r'&&!S.siren){ S.redRun=true; loseLife('冇開警號衝紅燈','冇開警號衝紅燈！'); } else if(st==='r'&&S.siren) toast('開咗警號，小心慢駛過燈'); }
      S.inX=inX; }
    // 導航
    // 偏離路線先重新計（唔會每秒都重畫）
    S.routeT+=dt; S.routeDrawT=(S.routeDrawT||0)+dt; if(S.route&&S.routeDrawT>0.3&&routeMesh&&routeMesh.visible){ S.routeDrawT=0; drawRoute(routeAhead()); } if(S.gm!=='chase'&&S.gm!=='free'){ const pr=S.route&&routeProj(); if((pr&&pr.d>11&&S.routeT>0.4)||S.routeT>8||(S.routeT>1.2&&S.target&&S.route&&S.route.pts.length>2&&Math.hypot(S.target[0]-S.car.x,S.target[1]-S.car.z)<55)){ S.routeT=0; refreshRoute(); } }
    const d=Math.hypot(c.x-S.target[0],c.z-S.target[1]);
    $('hDist').textContent=d>1000?(d/1000).toFixed(1)+' 公里':Math.round(d)+' 米';
    if(S.gm==='ems'&&S.step!==6){ legTimer(); dashTick(dt); } else if(S.step===6) $('hTime').textContent='—';
    if(S.route){ const n=d<22?S.target:lookAhead(18); const want=Math.atan2(n[0]-c.x,n[1]-c.z);
      if(S.arrowA==null) S.arrowA=want; S.arrowA+=(((want-S.arrowA)%(Math.PI*2)+Math.PI*3)%(Math.PI*2)-Math.PI)*Math.min(1,dt*7);
      arrow.position.set(c.x,7.8+ELEV(c.x,c.z)+Math.sin(t*4)*0.25,c.z); arrow.rotation.y=S.arrowA; }
    if(S.gm==='taxi') taxiTick(dt,d); else if(S.gm==='chase') chaseTick(dt); else if(S.gm==='free') freeTick(dt,t); else if(d<7.5){ S.step===1?arriveScene():S.step===6?realAtDepot():arriveHospital(); }
  }
  groundPose(amb,c.x,0.12,c.z,c.a,VSPEC.kl*6);
  ring.scale.setScalar(1+Math.sin(t*4)*0.06);
  /* --- 交通 --- */
  const SV=[]; if(S.siren&&S.mode==='drive') SV.push({x:c.x,z:c.z}); if(S.gm==='chase') CH.cops.forEach(p=>SV.push({x:p.x,z:p.z})); ESC.forEach(e=>{ if(e.pose&&e.m.visible&&!e.done) SV.push({x:e.pose.x,z:e.pose.z}); }); window.__SV=SV;
  const ALLV=cars.concat(trams,ESC);   // 每格只砌一次（之前每架車都砌一次）
  for(const k of cars){
    if(k.fly){ funCarTick(k,dt); continue; }   // 歡樂模式：彈飛緊
    if(!k.road) continue;
    let pose=carPose(k);
    if(k.stuck){ k.pose=pose; groundPose(k.m,pose.x,0.1,pose.z,pose.a,k.m.userData.len); if(k.haz) k.haz.forEach(h=>h.visible=Math.floor(t*3)%2===0); continue; }
    const dx=pose.x-c.x, dz=pose.z-c.z, dd=Math.hypot(dx,dz);
    if(k.waitEnd){ k.pose=pose; if(!inView(pose.x,pose.z)&&placeCar(k,c.x,c.z)) k.waitEnd=false; else { groundPose(k.m,pose.x,0.1,pose.z,pose.a,k.m.userData.len); continue; } pose=carPose(k); }
    if((dd>230||k.evict)&&!inView(pose.x,pose.z)&&S.mode==='drive'){ if(placeCar(k,c.x,c.z)){ k.evict=false; pose=carPose(k); k.cur=k.v; } }
    // 前面有救護車就停；開警號時靠邊減速讓路
    const fx=Math.sin(pose.a), fz=Math.cos(pose.a); const ahead=(-dx)*fx+(-dz)*fz, lat=Math.abs((-dx)*fz-(-dz)*fx);
    let target=k.v0||(k.v0=k.v);
    // 讓救護車：附近有響警號嘅救護車（玩家或者其他救護車）就靠邊減速；未入路口就喺停車線前等
    if(k.stubborn>0){ k.stubborn-=dt; if(k.stubborn<=0&&S.mode==='drive') toast('私家車終於讓路'); }   // 突發：唔留意警號嘅私家車
    for(const sv of SV){ const d2=Math.hypot(pose.x-sv.x,pose.z-sv.z); if(d2<55&&!(k.stubborn>0)) k.yield=2.5;
      if(SIGNAL[k.to]||DEG[k.to]>=3){ const N=NODES[k.to], rem=(1-k.t)*pose.L, sd=CLR[k.to]+4.6; if(rem>sd-1&&rem<sd+16&&Math.hypot(N[0]-sv.x,N[1]-sv.z)<50) target=Math.min(target,Math.max(0,(rem-sd)*0.9)); } }
    // 讓路：一邊向前行一邊靠左埋石壆，埋到邊就停低，開死火燈（前後四盞黃燈閃）
    if(k.yield>0){ k.yield-=dt; const want=k.road.w/2-(k.m.userData.len?1.9:1.5); const atKerb=Math.abs((k.off??0)-want)<0.3;
      target=Math.min(target,atKerb?0:4.5); yieldHaz(k,true,t); } else if(k.yh&&k.yh.on) yieldHaz(k,false,t);
    if(ahead>0&&ahead<14&&lat<3.5) target=0;
    // 紅綠燈：喺停車線前停
    if(SIGNAL[k.to]){ const stopD=CLR[k.to]+4.6;
      const rem=(1-k.t)*pose.L, st=lightState(k.to,pose.a,t); if(st!=='g'&&rem>stopD-0.8&&rem<stopD+18&&!(st==='y'&&rem<stopD+4)) target=Math.min(target,Math.max(0,(rem-stopD)*0.9)); }
    // 防重疊：前面路徑上（任何方向）有車／輕鐵就停低等；兩架互相擋住就號碼細嗰架先行
    k.id=k.id??cars.indexOf(k); let blocker=null;
    if(dd<180||inView(pose.x,pose.z)) for(const o of ALLV){ if(o===k||!o.pose) continue;   // 遠處睇唔到嘅車唔使計碰撞排隊
      const ex=o.pose.x-pose.x, ez=o.pose.z-pose.z; if(ex*ex+ez*ez>900) continue;
      const oL=(o.m.userData.len||4.4)/2+0.6, oW=(o.m.userData.len?1.4:1.2)+1.25, sa=Math.sin(o.pose.a), ca=Math.cos(o.pose.a), myL=(k.m.userData.len||4.4)/2;
      for(let q=myL;q<=myL+6;q+=1.5){ const px=pose.x+fx*q-o.pose.x, pz=pose.z+fz*q-o.pose.z; const al=px*sa+pz*ca, ac=px*ca-pz*sa;
        if(Math.abs(al)<oL&&Math.abs(ac)<oW){ blocker=o; break; } } if(blocker) break; }
    if(blocker&&!(blocker.blockedBy===k&&k.id<(blocker.id??99))) target=0;
    k.blockedBy=blocker;
    // 跟車：同方向前面有車就減速排隊
    const myLen=(k.m.userData.len||4.4)/2;
    for(const o of cars){ if(o===k||!o.pose) continue; const ex=o.pose.x-pose.x, ez=o.pose.z-pose.z; const ah=ex*fx+ez*fz; if(ah<=0||ah>26) continue;
      if(Math.abs(ex*fz-ez*fx)>2.2||Math.cos(o.pose.a-pose.a)<0.6) continue; const gap=ah-myLen-(o.m.userData.len||4.4)/2-2.2; target=Math.min(target,Math.max(0,gap*1.1)); }
    for(const p of peds){ if(p.mode!=='cross'||!p.pos||!p.onRoad) continue; const ex=p.pos[0]-pose.x, ez=p.pos[1]-pose.z; const ah=ex*fx+ez*fz; if(ah>0&&ah<12&&Math.abs(ex*fz-ez*fx)<3){ target=0; break; } }
    if(k.hit>0){ k.hit-=dt; target=0; }
    carLights(k.m,target<(k.cur??0)-0.4||(k.cur??0)<0.4);   // 剎車／停車：尾燈著
    // 讓路獎勵：響警號越過一架正在讓路嘅車，冇撞到佢
    if(k.yield>0&&S.siren&&S.mode==='drive'){ const pfx=Math.sin(c.a), pfz=Math.cos(c.a), rel=(pose.x-c.x)*pfx+(pose.z-c.z)*pfz, side=Math.abs((pose.x-c.x)*pfz-(pose.z-c.z)*pfx), half=(k.m.userData.len||4.4)/2;
      if(rel>half+1) k.yAhead=true; else if(k.yAhead&&rel<-half-1.5){ k.yAhead=false; if(!k.yHit&&side<9&&c.v>3){ S.yieldPass=(S.yieldPass||0)+1; } k.yHit=false; } }
    else { k.yAhead=false; k.yHit=false; }
    k.cur=(k.cur??target)+(target-(k.cur??target))*Math.min(1,dt*2);
    k.t+=k.cur*dt/(pose.L||1); if(k.t>=1){ nextEdge(k); }
    pose=carPose(k); k.pose=pose; groundPose(k.m,pose.x,0.1,pose.z,pose.a,k.m.userData.len);
    const da=((pose.a-k.m.rotation.y+Math.PI*3)%(Math.PI*2))-Math.PI; k.m.rotation.y+=da*Math.min(1,dt*6);
  }
  tramTick(dt); rainTick(dt); escortTick(dt,t); audioTick(t); updFrustum(); S.lightT=(S.lightT||0)+dt; if(S.lightT>0.25){ S.lightT=0; updateLights(t); }
  /* --- 行人 --- */
  if(FUN.on&&(!S.gm||S.gm==='ems')) pedFlyTick(dt);
  for(const p of peds){
    if(p.mode==='fly') continue;
    if(p.mode==='jump'){ const J=p.jmp; J.t+=dt/0.55; const k=Math.min(1,J.t); p.pos=[J.x0+(J.x1-J.x0)*k,J.z0+(J.z1-J.z0)*k]; p.m.position.set(p.pos[0],0.15+Math.sin(k*Math.PI)*1.3,p.pos[1]); p.m.rotation.set(0,J.ry,J.side*Math.sin(k*Math.PI)*0.6); walk(p.m,t,true,J.t*6);
      if(k>=1){ p.mode='idle'; p.m.rotation.set(0,J.ry+Math.PI,0); } continue; }
    if(p.mode==='down'&&p.downT!=null){ p.downT-=dt; if(p.downT<0){ p.downT=null; p.m.visible=false; p.m.rotation.set(0,0,0); if(placePed(p,c.x,c.z)) p.m.visible=true; else p.mode='down'; } }   // 瞓一陣之後消失
    if(p.mode==='down'&&!p.m.visible&&p.downT==null){ p.m.rotation.set(0,0,0); if(placePed(p,c.x,c.z)) p.m.visible=true; continue; }
    if(p.mode==='down'||p.mode==='idle'){ walk(p.m,t,false); if(!inView(p.pos[0],p.pos[1],4)&&Math.hypot(p.pos[0]-c.x,p.pos[1]-c.z)>40){ p.m.rotation.set(0,0,0); placePed(p,c.x,c.z); } p.m.position.set(p.pos[0],p.mode==='down'?0.5:0.15,p.pos[1]); continue; }
    if(p.mode==='dash'){ p.s+=3.4*dt; walk(p.m,t,true,p.s*3); p.pos=[p.x0+p.nx*p.s,p.z0+p.nz*p.s]; p.m.rotation.y=Math.atan2(p.nx,p.nz); if(p.s>p.len){ p.mode='idle'; } p.m.position.set(p.pos[0],0.15,p.pos[1]); continue; }
    if(p.mode==='walk'){ p.s+=p.dir*1.3*dt; if(p.s<p.lo||p.s>p.hi){p.dir*=-1; p.s=Math.max(p.lo,Math.min(p.hi,p.s));}
      const ux=(p.B[0]-p.A[0])/p.L, uz=(p.B[1]-p.A[1])/p.L; p.pos=[p.A[0]+ux*p.s+uz*p.off, p.A[1]+uz*p.s-ux*p.off];
      p.m.rotation.y=Math.atan2(ux*p.dir,uz*p.dir); walk(p.m,t,true,p.s); }
    else { // 過馬路：救護車響號接近時唔開始過
      const near=Math.hypot(p.cx-c.x,p.cz-c.z);
      if(p.wait>0){ p.wait-=dt; walk(p.m,t,false); if(S.siren&&near<40) p.wait=Math.max(p.wait,1); }
      else if(Math.abs(p.s)>=p.half-0.01&&p.node!=null&&lightState(p.node,p.ang,t)!=='r'){ walk(p.m,t,false); } // 等綠公仔（即係車行嘅方向紅燈）
      else { p.s+=p.dir*1.3*dt; walk(p.m,t,true,p.s); if(Math.abs(p.s)>p.half){ p.s=Math.sign(p.s)*p.half; p.dir*=-1; p.wait=2+Math.random()*5; } }
      p.pos=[p.cx+p.nx*p.s, p.cz+p.nz*p.s]; p.onRoad=Math.abs(p.s)<p.half-2.4; p.m.rotation.y=Math.atan2(p.nx*p.dir,p.nz*p.dir);
      if(Math.hypot(p.cx-c.x,p.cz-c.z)>220&&S.mode==='drive'&&!inView(p.pos[0],p.pos[1],4)) placePed(p,c.x,c.z); }
    if(p.mode==='walk'&&Math.hypot(p.pos[0]-c.x,p.pos[1]-c.z)>220&&S.mode==='drive'&&!inView(p.pos[0],p.pos[1],4)) placePed(p,c.x,c.z);
    p.m.position.set(p.pos[0],0.15,p.pos[1]);
  }
  ANI.tick(dt,t);   // 城市動物
  funTick(dt,t); realTick(dt); if(S.simOn) SIM.tick(dt); if(S.pcOn) PC.tick(dt,t);
  if(NEON) NEON.tick(t); busWaitTick(dt); TURNS.tick(dt,t); PLAY.tutTick(dt); PLAY.evTick(dt); HELP.tick(dt,t);
  gfxWatch(dt);
  /* --- 到場／醫院動畫 --- */
  if(S.mode==='seq'||S.mode==='hseq') sequence(dt,t);
  bystander.userData.arms[1].rotation.x=-2.6+Math.sin(t*8)*0.4;
  /* --- 鏡頭 --- */
  const portrait=innerWidth<innerHeight;
  let inDepot=S.mode==='drive'&&S.step===1&&!S.leftDepot&&!S.depotCam&&Math.hypot(c.x-DEPOT.pos[0],c.z-DEPOT.pos[1])<24&&!VIEW.active();
  if(inDepot&&(S.hold.G||S.hold.R||Math.abs(c.v)>0.5)){ // 一踩油：鏡頭由門口喺車側繞半圈去車尾（大約 1 秒），之後一直跟車
    S.depotCam=true; inDepot=false; S.swingT=1.6; S.camYaw=Math.atan2(c.x-cam.position.x,c.z-cam.position.z); }
  if(inDepot){ // 開波：鏡頭喺救護站門口，影住救護車由車房駛出嚟
    const fx=Math.sin(DEPOT.a), fz=Math.cos(DEPOT.a); S.camYaw=c.a;
    cam.position.lerp(new THREE.Vector3(DEPOT.pos[0]+fx*34,12,DEPOT.pos[1]+fz*34),Math.min(1,dt*3)); // 正對車房門口，避開招牌同牆
    camLook.lerp(new THREE.Vector3(c.x,2,c.z),Math.min(1,dt*6));
    if(!S.hold.G&&c.v<0.5) caption(VSPEC.siren?'按住「油」出車；撳「警號」開閃燈同警號':'按住「油」出車；呢款車冇警號，其他車唔會讓路，要守交通燈'); else caption(null);
  } else if(S.mode==='drive'||S.mode==='over'){
    if(S.step===1&&S.leftDepot!==true){ S.leftDepot=true; caption(null); if(S.gm==='ems') PLAY.radio('A188 收到，出車前往'+S.kase.place+'。','A188'); if(S.level&&S.level.escort) launchEscorts(S.level.escort); if(S.level&&S.level.support) queueSupport(S.level.support); }
    // 車仲喺車房入面：鏡頭最多繞到車側，留喺門口外面同低位，唔會俾車房屋頂同牆遮住；車尾出咗門先繞埋去車後
    if(VIEW.active()){ S.camYaw=c.a; S.swingT=0; S.depotCam=true; VIEW.camCock(dt,t,cam,camLook); } else {   // 👁️ 車內視線
    const DP=DEPOT.pos, hx=Math.sin(DEPOT.a), hz=Math.cos(DEPOT.a), sC=(c.x-DP[0])*hx+(c.z-DP[1])*hz, latC=(c.x-DP[0])*hz-(c.z-DP[1])*hx;
    const inBay=S.depotCam&&S.step===1&&sC>-12&&sC<16&&Math.abs(latC)<12, prog=Math.max(0,Math.min(1,sC/16));
    if(S.wasBay&&!inBay) S.swingT=1.6; S.wasBay=inBay;
    const dYaw=((c.a-S.camYaw+Math.PI*3)%(Math.PI*2)-Math.PI);
    if(inBay){ const sg=Math.sign(-dYaw)||1; S.camYaw=c.a+sg*Math.max(Math.PI*(1-prog),Math.abs(dYaw)-3.4*dt); }   // 車行得越出，鏡頭繞得越後
    else if(S.swingT>0){ S.swingT-=dt; const st=3.4*dt; S.camYaw+=Math.abs(dYaw)<=st?dYaw:Math.sign(dYaw)*st; if(Math.abs(dYaw)<0.05) S.swingT=0; }
    else S.camYaw+=dYaw*Math.min(1,dt*4.5);
    camDragTick(dt); const D=S.camDrag, yaw=S.camYaw+D.yaw;
    S.hwK=(S.hwK||0)+(((ANI.hw()&&S.leftDepot&&!(S.gm==='free'&&FRE.onFoot))?1:0)-(S.hwK||0))*Math.min(1,dt*1.2); const hk=S.hwK;   // 高速公路鏡頭：低啲、望遠啲，見到天空
    const foot=S.gm==='free'&&FRE.onFoot, vi=foot?Math.min(1,VIEW.i):VIEW.i, rk=vi>=1?1:0, ch=vi===2, fs=foot?0.5:1;   // 👁️ 視線：0 救護任務、1 寫實（低鏡頭、貼車）、2 貼車追尾
    const back=(portrait?19:16)*fs*(1-D.pitch*0.25)*(ch?(portrait?0.4:0.46):rk?(S.pcOn?0.74*PC.zoom:0.8):1), up=(portrait?14:10.5)*fs*(1+D.pitch)*(1-0.42*hk)*(ch?(portrait?0.27:0.33):rk?(S.pcOn?0.36*(0.6+0.4*PC.zoom):0.48):1);
    const eh=ELEV(c.x,c.z);
    if(inBay){ const R=16+(back-16)*prog, W=new THREE.Vector3(c.x-Math.sin(yaw)*R,5.5+(up-5.5)*prog,c.z-Math.cos(yaw)*R); const sw=(W.x-DP[0])*hx+(W.z-DP[1])*hz;
      if(sw<9.5){ W.x+=hx*(9.5-sw); W.z+=hz*(9.5-sw); W.y=Math.max(W.y,10); }   // 鏡頭唔入車房：最多退到門口上方
      cam.position.lerp(W,Math.min(1,dt*8)); camLook.lerp(new THREE.Vector3(c.x+Math.sin(c.a)*6*prog,1.6,c.z+Math.cos(c.a)*6*prog),Math.min(1,dt*9)); }
    else { const nearDepot=S.depotCam&&S.step===1&&sC>-12&&sC<45&&Math.abs(latC)<30; /* 只計救護站門前，唔計站後面條路 */ const CW=new THREE.Vector3(c.x-Math.sin(yaw)*back,up+eh,c.z-Math.cos(yaw)*back); if(nearDepot){ const sw=(CW.x-DP[0])*hx+(CW.z-DP[1])*hz; if(sw<9.5){ CW.x+=hx*(9.5-sw); CW.z+=hz*(9.5-sw); } } cam.position.lerp(nearDepot?CW:clampCam(CW,new THREE.Vector3(c.x,0,c.z)),Math.min(1,dt*(D.on||S.swingT>0?12:6)));
    camLook.lerp(new THREE.Vector3(c.x+Math.sin(yaw)*(6+34*hk+(ch?16:rk?10:0)),1.5+4*hk+eh+(ch?1.9:rk?1.4:0),c.z+Math.cos(yaw)*(6+34*hk+(ch?16:rk?10:0))),Math.min(1,dt*9)); }
    }
  } else if(S.mode==='seq'||S.mode==='hseq'||S.mode==='result'){
    const P=S.mode==='hseq'?AE.door:(S.kase.loc?S.kase.loc.patient:[c.x+Math.sin(c.a)*8,c.z+Math.cos(c.a)*8]); const rear=[c.x-Math.sin(c.a)*4,c.z-Math.cos(c.a)*4];
    const mx=(rear[0]+P[0])/2, mz=(rear[1]+P[1])/2; let dx=mx-P[0], dz=mz-P[1]; const L=Math.hypot(dx,dz)||1; dx/=L; dz/=L;
    let want=new THREE.Vector3(mx+dx*(portrait?11:10),portrait?34:26,mz+dz*(portrait?11:10));
    if(S.simOn&&S.mode==='seq'&&document.body.classList.contains('simScene')){ const cv=SIM.cam(t); want=cv.p; if(portrait){ want.y+=1.5; } camLook.lerp(cv.l,Math.min(1,dt*2)); }
    const simC=S.simOn&&S.mode==='seq'&&document.body.classList.contains('simScene'); cam.position.lerp(clampCam(want,simC?camLook.clone().setY(0):new THREE.Vector3(mx,0,mz),simC),Math.min(1,dt*(simC?1.2:1.5))); if(!simC) camLook.lerp(new THREE.Vector3(mx,1,mz),Math.min(1,dt*2));
  } else if(S.mode==='cpr'){ cprCam(dt,t);
  } else { // 主選單：喺救護站上空慢慢轉
    const d=DEPOT.pos; const a=t*0.08; cam.position.set(d[0]+Math.sin(a)*80,55,d[1]+Math.cos(a)*80); camLook.set(d[0],0,d[1]);
    amb.position.set(d[0],0.12,d[1]); amb.rotation.y=DEPOT.a; }
  cam.lookAt(camLook);
  sun.position.set(cam.position.x+30,60,cam.position.z+20); sun.target.position.set(camLook.x,0,camLook.z);
  if(toastT>0){ toastT-=dt; if(toastT<=0) $('toast').classList.remove('show'); }
  if(S.mode==='drive') drawMini();
  { const px=cam.position.x, pz=cam.position.z; for(const q of INSTC){ const d=Math.hypot(q.c.x-px,q.c.z-pz)-q.r; q.m.visible=d<q.far; } }   // 遠嘅樹同街燈唔畫
  if((S.pkT=(S.pkT||0)+1)%15===0){ const px=cam.position.x, pz=cam.position.z; for(const c of PARKM){ const dx=c.position.x-px, dz=c.position.z-pz; c.visible=dx*dx+dz*dz<28900; } }
  // 速度感：揸快時視野變闊、畫面邊有速度線；撞車時鏡頭震一震
  { const sp=S.mode==='drive'?Math.abs(S.car.v)/Math.max(10,VSPEC.vmax):0, red=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const vi=VIEW.active()?3:VIEW.i, want=(vi===3?(innerWidth<innerHeight?78:66):vi===2?Math.min(FOV0,60):vi===1?Math.min(FOV0,58):FOV0)+(red?0:sp*sp*(vi===3?5:12)); if(Math.abs(cam.fov-want)>0.05){ cam.fov+=(want-cam.fov)*Math.min(1,dt*3); cam.updateProjectionMatrix(); }
    const so=red?0:Math.max(0,(sp-0.62)/0.38); const fx=$('speedfx'); if(fx){ fx.style.opacity=(so*0.75).toFixed(2); if(so>0) fx.style.transform='rotate('+((t*37)%3)+'deg) scale(1.15)'; }
    if(S.shake>0&&!red){ S.shake=Math.max(0,S.shake-dt); const k=S.shake*1.6; cam.position.x+=(Math.random()-0.5)*k; cam.position.y+=(Math.random()-0.5)*k; } }
  DRES.tick(); VIEW.pre(); if(REAL.on) realRender(t); else R.render(scene,cam); VIEW.post(dt,t); requestAnimationFrame(tick);
}
/* ---------- 到場：揀裝備、急救小測（各一題，錯就扣一粒） ---------- */
function openChoice(kind){ S.quizOpen=true; sirenMute(true); S.qKind=kind; caption(null); const Q=kind==='equip'?S.kase.equip:kind==='triage'?S.kase.triage:S.kase.quiz[0]; const n=Q.o.length;
  const order=[...Array(n).keys()].sort(()=>Math.random()-0.5);
  $('qNum').textContent=kind==='equip'?'🧰 到場揀裝備':kind==='triage'?'🏥 分流：送邊間醫院？':'📝 急救小測'; $('qText').textContent=Q.q; $('qWhy').textContent=''; $('qNext').style.display='none';
  $('qOpts').innerHTML=order.map(i=>'<button class="qo" data-i="'+i+'"></button>').join('');
  $('qOpts').querySelectorAll('.qo').forEach(b=>{ b.textContent=Q.o[+b.dataset.i]; b.onclick=()=>{ if($('qNext').style.display!=='none') return; const ok=+b.dataset.i===0;
    if(ok) S.qScore++; else S.qPending=1; if(kind==='equip') S.equipOk=ok; else if(kind==='triage'){ S.triageOk=ok; S.dest=Q.dest[0]; } else S.quizOk=ok;
    $('qOpts').querySelectorAll('.qo').forEach(x=>{ x.disabled=true; if(+x.dataset.i===0) x.classList.add('ok'); else if(x===b) x.classList.add('bad'); });
    $('qWhy').innerHTML='<b>'+(ok?'答啱！':(kind==='equip'?'揀錯裝備，扣 1 粒生命之星。':kind==='triage'?'分流揀錯醫院，扣 1 粒生命之星，改送正確醫院。':'答錯咗，扣 1 粒生命之星。'))+'</b> '; $('qWhy').append(Q.why); $('qNext').style.display='block'; $('qNext').focus(); }; });
  show('quiz',true); }
$('qNext').onclick=()=>{ show('quiz',false); const k=S.qKind==='equip'?0:S.qKind==='triage'?2:1; S.qDone[k]=true; S.quizOpen=false; sirenMute(false);
  if(S.qPending){ S.qPending=0; const why=['揀錯裝備','急救小測答錯','分流揀錯醫院'][k]; loseLife(why,why); } };

/* ---------- 動畫序列 ---------- */
function sequence(dt,t){
  if(S.quizOpen){ walk(crew.userData.c1,t,false); walk(crew.userData.c2,t,false); return; }
  S.seq+=dt;
  if(S.simOn){ if(S.mode==='seq'&&!S.simSceneDone&&S.seq>=3.3){ S.seq=3.3; SIM.atScene(); } if(S.mode==='hseq'&&!S.simHandDone&&S.seq>=4.3){ S.seq=4.3; SIM.atHosp(); } if(document.body.classList.contains('simScene')){ SIM.anim(dt,t); return; } }   // 現場模擬：救護員跪喺病人旁邊等玩家處理
  if(S.mode==='seq'&&S.seq>=3.2){ if(!S.qDone[0]){ S.seq=3.2; openChoice('equip'); return; } if(!S.qDone[1]){ S.seq=3.2; openChoice('quiz'); return; } if(!S.qDone[2]){ S.seq=3.2; openChoice('triage'); return; } }
  const s=S.seq, c=S.car, U=amb.userData, C1=crew.userData;
  const rear=new THREE.Vector3(c.x-Math.sin(c.a)*4.8,0.12,c.z-Math.cos(c.a)*4.8), inside=new THREE.Vector3(c.x-Math.sin(c.a)*1.2,0.55,c.z-Math.cos(c.a)*1.2);
  const kneel=(on)=>{ C1.c1.position.y=on?-0.38:0; C1.c2.position.y=on?-0.3:0; };
  const doorA=s<0.8?s/0.8:1; const close=S.mode==='seq'?(s>9.6?Math.min(1,(s-9.6)/0.6):0):(s>8?Math.min(1,(s-8)/0.6):0);
  U.doors.forEach(d=>d.rotation.y=-d.userData.s*1.65*doorA*(1-close));
  const look=(a,b)=>Math.atan2(b.x-a.x,b.z-a.z);
  if(S.mode==='seq'){
    const P=new THREE.Vector3(S.kase.loc.patient[0]+1.4,0.15,S.kase.loc.patient[1]);
    const st=S.kase.steps;
    if(s<0.8){ KIT.visible=false; kneel(false); crew.visible=s>0.25; if(crew.visible){ const k=Math.min(1,(s-0.25)/0.55); crew.position.lerpVectors(inside,rear,k); crew.rotation.y=look(rear,inside); walk(C1.c1,t,true); walk(C1.c2,t,true,1); } caption('救護員落車，攞車床同急救裝備'); }   // 車床由車尾推出
    else if(s<3.2){ crew.visible=true; const k=(s-0.8)/2.4; crew.position.lerpVectors(rear,P,k); crew.rotation.y=look(rear,P); walk(C1.c1,t,true); walk(C1.c2,t,true,1); caption('救護員落車，攞車床同急救裝備'); }
    else if(s<5.0){ walk(C1.c1,t,false); walk(C1.c2,t,false); caption(st[0]); kneel(true); C1.c1.userData.arms.forEach(a=>a.rotation.x=-0.8-Math.sin(s*5)*0.4); C1.c2.userData.arms.forEach(a=>a.rotation.x=-0.5-Math.sin(s*3+1)*0.25);
      if(!KIT.visible){ KIT.visible=true; const ax=Math.sin(c.a), az=Math.cos(c.a); KIT.position.set(P.x-az*1.3-ax*0.6,0,P.z+ax*1.3-az*0.6); KIT.rotation.y=c.a+0.4; } }   // 救護員跪低評估，急救袋擺喺側邊
    else if(s<6.6){ caption(st[1]); if(s>6.2) kneel(false); if(patient.parent!==C1.st){ C1.st.attach(patient); patient.position.set(0,0.7,0.3); patient.rotation.set(0,0,0); patient.userData.blanket.visible=true; } }
    else if(s<9.0){ KIT.visible=false; kneel(false); const k=(s-6.6)/2.4; crew.position.lerpVectors(P,rear,k); crew.rotation.y=look(P,rear); walk(C1.c1,t,true); walk(C1.c2,t,true,1); caption(st[2]); }
    else if(s<9.6){ const k=Math.min(1,(s-9.0)/0.5); crew.position.lerpVectors(rear,inside,k); crew.rotation.y=look(rear,inside); walk(C1.c1,t,k<1); walk(C1.c2,t,k<1,1); crew.visible=k<1; }   // 推車床上車
    else if(s>10.6){ toHospital(); bystander.visible=false; }
  } else {
    const D=new THREE.Vector3(AE.door[0],0.15,AE.door[1]); const P=rear.clone().lerp(D,0.85);
    if(s<0.8){ caption('到達急症室，準備交接病人'); crew.visible=s>0.25; if(crew.visible){ const k=Math.min(1,(s-0.25)/0.55); crew.position.lerpVectors(inside,rear,k); crew.rotation.y=look(rear,inside); walk(C1.c1,t,true); walk(C1.c2,t,true,1); } }   // 落車床
    else if(s<4.2){ crew.visible=true; const k=(s-0.8)/3.4; crew.position.lerpVectors(rear,P,k); crew.rotation.y=look(rear,D); walk(C1.c1,t,true); walk(C1.c2,t,true,1); caption('推病人入急症室'); }
    else if(s<7.0){ walk(C1.c1,t,false); walk(C1.c2,t,false); caption('向醫護人員交代病人情況同處理'); }
    else if(s<8.0){ crew.visible=false; caption('任務完成！'); }
    else if(s>9.0){ finish(); }
  }
}
/* ================= 遊戲性：限時、突發事件、病人穩定度、日夜天氣、成就、車款、排行榜 ================= */
const store={ get(k,d){ try{ const v=localStorage.getItem('a188.'+k); return v?JSON.parse(v):d; }catch(e){ return d; } }, set(k,v){ try{ localStorage.setItem('a188.'+k,JSON.stringify(v)); }catch(e){} } };
// 🎉 歡樂模式狀態（要早過選單同遊戲迴圈定義；功能喺 fun.part.js）
const FUN={ unlocked:!!store.get('funU',0), on:false, score:0, combo:0, comboT:0, slow:0 };   // 每次開遊戲都由關閉開始；解鎖咗嘅話可以喺設定再開
// 🚶 行人自動避開（預設開）：救護車衝埋去會跳開；關咗就會撞倒、瞓喺地下一陣再消失
const DODGE={on:store.get('dodge',true)};
function bestStars(){ return store.get('best2',{}); }
function saveBest(id,st){ const b=bestStars(); if(!(b[id]>=st)){ b[id]=st; store.set('best2',b); } }
function markDone(id){ const d=store.get('done',{}); d[id]=1; store.set('done',d); }
function isDone(id){ return !!store.get('done',{})[id]; }
const getName=()=>store.get('name','')||'';
const totalStars=()=>Object.values(bestStars()).reduce((a,b)=>a+b,0);

/* ---------- 日夜同天氣 ---------- */
const TOD={day:{sky:0xaed8f5,hemi:[0xf4f8ff,0xa8b898,0.62],sun:[0xfff6e8,0.62],fog:[210,560],cloud:0xffffff},
  dusk:{sky:0xf6b993,hemi:[0xffe0c8,0xa08878,0.52],sun:[0xffa060,0.6],fog:[180,520],cloud:0xffd6c0},
  night:{sky:0x18213b,hemi:[0x8090c8,0x202838,0.34],sun:[0x9fb0ff,0.16],fog:[150,460],cloud:0x3a4460,night:true},
  rain:{sky:0x2a3446,hemi:[0x8a9ab0,0x303840,0.38],sun:[0xaab4c8,0.18],fog:[90,330],cloud:0x505a68,night:true,wet:true}};
const headL=new THREE.SpotLight(0xfff4d0,0,70,0.55,0.6,1); headL.position.set(0,2.2,2.5); amb.add(headL); const headT=new THREE.Object3D(); headT.position.set(0,0,30); amb.add(headT); headL.target=headT;
const rain=(()=>{ const N=1400, pos=new Float32Array(N*6); for(let i=0;i<N;i++){ const x=(Math.random()-0.5)*140, y=Math.random()*60, z=(Math.random()-0.5)*140; pos.set([x,y,z,x+0.15,y-1.4,z],i*6); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const m=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0xb8c8e8,transparent:true,opacity:0.55})); m.visible=false; m.frustumCulled=false; scene.add(m); return m; })();
/* 落雨：地面水花（車附近） */
const SPLASH=(()=>{ const N=70, c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d'); g.strokeStyle='rgba(220,235,255,.9)'; g.lineWidth=4; g.beginPath(); g.arc(32,32,24,0,7); g.stroke();
  const im=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,opacity:0.55,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-6,polygonOffsetUnits:-6}),N);
  im.frustumCulled=false; im.visible=false; scene.add(im); const D=[...Array(N)].map(()=>({x:0,z:0,t:9,l:1})); const o=new THREE.Object3D();
  return { tick(dt){ im.visible=rain.visible; if(!im.visible) return; const c=S.car, fx=Math.sin(c.a), fz=Math.cos(c.a);
    D.forEach((d,i)=>{ d.t+=dt; if(d.t>d.l){ d.t=0; d.l=0.35+Math.random()*0.35; const f=Math.random()*34-6, l=(Math.random()-0.5)*22; d.x=c.x+fx*f+fz*l; d.z=c.z+fz*f-fx*l; d.y=ELEV(d.x,d.z)+0.26; }
      const k=d.t/d.l, sc=0.15+k*0.9; o.position.set(d.x,d.y,d.z); o.rotation.set(-Math.PI/2,0,0); o.scale.set(sc*(1-k*0.3),sc*(1-k*0.3),1); o.updateMatrix(); im.setMatrixAt(i,o.matrix); });
    im.instanceMatrix.needsUpdate=true; } }; })();
/* 夜晚／落雨：車頭燈光柱 */
const BEAM=(()=>{ const m=new THREE.MeshBasicMaterial({color:0xfff1c8,transparent:true,opacity:0.09,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
  const geo=new THREE.ConeGeometry(2.6,16,16,1,true); geo.translate(0,-8,0); geo.rotateX(-Math.PI/2+0.06);   // 尖端喺車頭燈，向前散開
  const bs=[-0.95,0.95].map(x=>{ const b=new THREE.Mesh(geo,m); b.position.set(x,1.55,3.7); b.visible=false; amb.userData.body.add(b); return b; });
  return { tick(){ const on=!!CARL.night&&S.mode!=='menu'; bs.forEach(b=>b.visible=on); m.opacity=S.wet?0.07:0.045; } }; })();
function rainTick(dt){ SPLASH.tick(dt); BEAM.tick(); if(!rain.visible) return; const p=rain.geometry.attributes.position.array; for(let i=0;i<p.length;i+=6){ p[i+1]-=55*dt; p[i+4]-=55*dt; if(p[i+4]<0){ p[i+1]+=60; p[i+4]+=60; } }
  rain.geometry.attributes.position.needsUpdate=true; rain.position.set(cam.position.x,0,cam.position.z); }
function setTOD(k){ if(S.pcOn&&TOD['pc'+k]) k='pc'+k; const T=TOD[k]; CARL.night=!!(T.night||k==='rain'); if(typeof NEON!=='undefined'&&NEON) NEON.set(T,k); scene.background.setHex(T.sky); scene.fog.color.setHex(T.sky); scene.fog.near=T.fog[0]; scene.fog.far=T.fog[1]; cam.far=T.fog[1]+60; cam.updateProjectionMatrix();
  hemi.color.setHex(T.hemi[0]); hemi.groundColor.setHex(T.hemi[1]); hemi.intensity=T.hemi[2]; sun.color.setHex(T.sun[0]); sun.intensity=T.sun[1]; CLOUDMAT.color.setHex(T.cloud);
  Object.values(MAT).forEach(m=>{ if(m.map&&m.emissive){ m.emissiveMap=T.night?m.map:null; m.emissive.setHex(T.night?0x2a261c:0); m.needsUpdate=true; } }); // 夜晚：窗口有燈
  headL.intensity=T.night?2.4:0; rain.visible=!!T.wet; S.wet=!!T.wet; if(S.pcOn&&S.pcPal) S.pcPal(T); else if(PCB) PCB.setEnv(null,!!T.night); }

/* ---------- 限時：每段路程有時限，準時到 +1 生命之星，超時 −1 生命之星 ---------- */
function startLeg(){ setupEvents(); const len=S.route?S.route.len:400; S.legLimit=Math.round(len/16*S.level.limit/1.4+15); if(S.tut) S.legLimit*=3; S.legStart=performance.now()/1000; S.overT=false; }
function legLeft(){ return S.legLimit-(performance.now()/1000-S.legStart); }
function legTimer(){ const r=legLeft(), el=$('hTime');
  if(r>=0){ el.textContent=fmt(r); el.classList.toggle('warn',r<15); }
  else { el.textContent='超時 +'+fmt(-r); el.classList.add('warn'); if(!S.overT){ S.overT=true; loseLife('超時','超時！病人等得太耐'); } } }
function endLeg(){ if(legLeft()>=0){ S.onTime++; if(S.lives<5){ S.lives++; drawLives(); toast('準時到達！獎勵 +1 生命之星'); } else toast('準時到達！'); } }

/* ---------- 病人穩定度（送院途中） ---------- */
function drawStab(){ const v=Math.max(0,S.stab); $('stabBar').style.width=v+'%'; $('stabBar').style.background=v>60?'#21b46b':v>30?'#f5a623':'#e8323c'; $('stabBox').setAttribute('aria-label','病人穩定度 '+Math.round(v)+'%'); }
function stabHit(n){ if(S.step!==4||FUN.on) return; S.stab-=n; S.stabLow=Math.min(S.stabLow,S.stab); drawStab(); }
function stabilityTick(dt,steer){ if(S.step!==4||S.mode!=='drive') return; const c=S.car, v=Math.abs(c.v);
  let drop=0; const lat=v*Math.abs(steer)*2.2*Math.min(1,v/5+0.35); if(lat>26) drop+=(lat-26)*0.35;
  if(S.hold.B&&c.v>12) drop+=9; if(!(cellAt(c.x,c.z)&1)&&v>8) drop+=6;
  if(drop>0){ S.stab-=drop*dt; if(!S.stabWarn||performance.now()-S.stabWarn>4000){ S.stabWarn=performance.now(); if(drop>6) caption('轉彎同煞車要慢慢嚟，病人喺車廂入面！'); } }
  else { S.stab=Math.min(100,S.stab+3*dt); if(S.stabWarn&&performance.now()-S.stabWarn>2500){ caption(null); S.stabWarn=0; } }
  S.stabLow=Math.min(S.stabLow,S.stab); if(S.stab<=0){ S.stab=55; loseLife('病人情況轉差','揸得太急，病人情況轉差！'); } drawStab(); }

/* ---------- 突發事件：修路封路、壞車塞車、行人衝出馬路 ---------- */
const CLOSED=[], EVT={meshes:[],cells:[],stuck:[]};
// 封路圍欄會唔會壓到第隔離另一條路（例如路口附近兩條路貼得好近）
function barrierClear(a,b,r){ const A=NODES[a],B=NODES[b]; const [ux,uz]=dirn(A,B), nx=uz, nz=-ux, M0=[(A[0]+B[0])/2,(A[1]+B[1])/2];
  for(const o of [-r.w/2,-r.w/4,0,r.w/4,r.w/2]) for(const z of [-1.2,1.2]){ const x=M0[0]+nx*o+ux*z, zz=M0[1]+nz*o+uz*z;
    for(const q of MAP.roads){ if(q===r||q.elev) continue; const P=NODES[q.n[0]],Q=NODES[q.n[1]], dx=Q[0]-P[0],dz=Q[1]-P[1],L2=dx*dx+dz*dz||1; let t=((x-P[0])*dx+(zz-P[1])*dz)/L2; t=Math.max(0,Math.min(1,t)); if(Math.hypot(P[0]+dx*t-x,P[1]+dz*t-zz)<q.w/2+1.5) return false; } }
  return true; }
function routeEdges(){ const P=S.route?S.route.path:[]; const out=[]; for(let i=2;i<P.length-3;i++){ const r=EDGE[P[i]+'-'+P[i+1]]; if(r&&!r.bridge&&!r.closed&&r.t!=='avenue'&&barrierClear(P[i],P[i+1],r)){ const A=NODES[P[i]],B=NODES[P[i+1]]; if(Math.hypot(B[0]-A[0],B[1]-A[1])>(DEG[P[i]]>=3||DEG[P[i+1]]>=3?2*Math.max(NW[P[i]]||0,NW[P[i+1]]||0)+24:16)) out.push([P[i],P[i+1],r]); } } return out; }
function closeRoad(a,b,r,lab){ r.closed=true; CLOSED.push(r); const A=NODES[a],B=NODES[b]; const [ux,uz]=dirn(A,B), nx=uz, nz=-ux, M0=[(A[0]+B[0])/2,(A[1]+B[1])/2];
  const g=new THREE.Group(); g.position.set(M0[0],0,M0[1]); g.rotation.y=Math.atan2(ux,uz); scene.add(g); EVT.meshes.push(g);
  const stripe=canvasTex(128,32,(c,w,h)=>{ for(let i=0;i<8;i++){ c.fillStyle=i%2?'#ffffff':'#ff6a13'; c.beginPath(); c.moveTo(i*16,0); c.lineTo(i*16+16,0); c.lineTo(i*16,32); c.lineTo(i*16-16,32); c.fill(); } },true);
  stripe.repeat.set(r.w/4,1); [-1.2,1.2].forEach(z=>{ add(new THREE.BoxGeometry(r.w,0.9,0.25),new THREE.MeshStandardMaterial({map:stripe}),g,0,1.1,z,true);
    for(let x=-r.w/2+0.5;x<=r.w/2;x+=r.w/3) add(new THREE.BoxGeometry(0.2,1.2,0.2),M(0x9aa1aa),g,x,0.6,z,false); });
  for(let x=-r.w/2+1;x<r.w/2;x+=2.2) add(new THREE.ConeGeometry(0.4,1.1,10),M(0xff6a13),g,x,0.7,-3.2,false);
  labelPlane(lab||'修路 請改道',0,2.8,-1.45,Math.PI,'#ff6a13',6,g); labelPlane(lab||'修路 請改道',0,2.8,1.45,0,'#ff6a13',6,g);
  // 碰撞：封住成條路
  for(let o=-r.w/2;o<=r.w/2;o+=1){ for(const z of [-1.2,0,1.2]){ const x=M0[0]+nx*o+ux*z, zz=M0[1]+nz*o+uz*z; const k=gi(x,zz); if(k>=0&&!(grid[k]&2)){ EVT.cells.push(k); grid[k]|=2; } } }
  cars.forEach(c=>{ if(c.road===r&&!c.stuck) c.evict=true; }); return r; } // 封路上面嘅車：出咗鏡頭先搬走
function hazardCar(a,b,r,t,broken){ const m=carModel(broken?'car':['car','taxi','minibus'][Math.random()*3|0]); const c={m,from:a,to:b,road:r,t,stuck:true,yield:0,id:900+EVT.stuck.length};
  if(broken){ c.haz=[[-1,-2.25],[1,-2.25],[-1,2.25],[1,2.25]].map(([x,z])=>add(new THREE.BoxGeometry(0.4,0.25,0.15),new THREE.MeshBasicMaterial({color:0xffa31a}),m.children[0],x*0.85,1.0,z,false));
    const tri=add(new THREE.ConeGeometry(0.5,0.9,3),M(0xff3b30),scene,0,0,0,false); c.tri=tri; EVT.meshes.push(tri); }
  cars.push(c); EVT.stuck.push(c); const p=carPose(c); c.pose=p; m.position.set(p.x,0.1,p.z); m.rotation.y=p.a;
  if(c.tri){ c.tri.position.set(p.x-Math.sin(p.a)*7,0.6,p.z-Math.cos(p.a)*7); } return c; }
function setupEvents(){ const lv=S.level; if(!lv||S.tut) return; const msgs=[];
  for(let n=0;n<lv.works;n++){ const E=routeEdges(); if(!E.length) break; const [a,b,r]=E[(E.length*(0.35+Math.random()*0.4))|0];
    const m0=EVT.meshes.length, c0=EVT.cells.length; closeRoad(a,b,r); refreshRoute(true);
    // 封咗之後搵唔到第二條路（路線仲行緊封咗嗰段）：取消呢個封路，唔好整一道擋路嘅牆
    const P=S.route?S.route.path:[]; let bad=false; for(let i=1;i<P.length;i++){ const q=EDGE[P[i-1]+'-'+P[i]]; if(q&&q.closed) bad=true; }
    if(bad){ EVT.meshes.splice(m0).forEach(m=>scene.remove(m)); EVT.cells.splice(c0).forEach(k=>grid[k]&=~2); r.closed=false; CLOSED.splice(CLOSED.indexOf(r),1); refreshRoute(true); continue; }
    msgs.push((r.name||'前面')+'修路封路'); }
  if(lv.jam&&Math.random()<0.9){ const E=routeEdges(); if(E.length){ const [a,b,r]=E[(E.length*(0.2+Math.random()*0.5))|0]; const L=Math.hypot(NODES[b][0]-NODES[a][0],NODES[b][1]-NODES[a][1]);
      cars.forEach(c=>{ if(c.road===r&&!c.stuck&&!(c.pose&&inView(c.pose.x,c.pose.z))) placeCar(c,S.car.x,S.car.z); });
      hazardCar(a,b,r,0.7,true); for(let q=1;q<=3;q++){ const t=0.7-q*6.5/L; if(t>0.08) hazardCar(a,b,r,t,false); } msgs.push((r.name||'前面')+'有壞車，車龍好長'); } }
  if(msgs.length){ setTimeout(()=>{ if(S.mode!=='drive') return; $('call').textContent='控制中心：'+msgs.join('；')+'。跟住新路線，或者開警號小心越過。'; show('callBox',true); setTimeout(()=>show('callBox',false),4500); },S.step===1?4600:600); } }
function clearEvents(){ EVT.meshes.forEach(m=>scene.remove(m)); EVT.meshes.length=0; EVT.cells.forEach(k=>grid[k]&=~2); EVT.cells.length=0;
  CLOSED.forEach(r=>r.closed=false); CLOSED.length=0; EVT.stuck.forEach(c=>{ scene.remove(c.m); const i=cars.indexOf(c); if(i>=0) cars.splice(i,1); }); EVT.stuck.length=0; }
function dashTick(dt){ if(!(S.dashLeft>0)||!S.leftDepot) return; S.dashT-=dt; const c=S.car; if(S.dashT>0||c.v<10) return;
  const fx=Math.sin(c.a), fz=Math.cos(c.a), P=[c.x+fx*34,c.z+fz*34]; if(!(cellAt(P[0],P[1])&1)){ S.dashT=2; return; }
  const p=peds.find(q=>q.mode!=='dash'&&q.mode!=='down'&&q.pos&&Math.hypot(q.pos[0]-c.x,q.pos[1]-c.z)>60&&!inView(q.pos[0],q.pos[1],4)); if(!p){ S.dashT=2; return; }
  const side=Math.random()<0.5?1:-1, nx=fz*side, nz=-fx*side; if(NEON&&NEON.rail.blockedSeg([P[0]-nx*10,P[1]-nz*10],[P[0]+nx*10,P[1]+nz*10])){ S.dashT=1.5; return; }   // 有欄杆嘅位唔會有人衝出嚟
  Object.assign(p,{mode:'dash',x0:P[0]-nx*10,z0:P[1]-nz*10,nx,nz,s:0,len:20});
  S.dashLeft--; S.dashT=18+Math.random()*14; toast('⚠️ 小心！有人衝出馬路！'); }

/* ---------- 成就同車款 ---------- */
const ACH={first:{ic:'🚑',name:'首次出車',d:'完成任何一關'},perfect:{ic:'✳️',name:'完美任務',d:'保住全部 5 粒生命之星完成一關'},
  ontime:{ic:'⏱️',name:'分秒必爭',d:'到場同送院兩段都準時'},steady:{ic:'🛏️',name:'穩如泰山',d:'送院途中病人穩定度保持 85% 以上'},
  quiz:{ic:'🧠',name:'急救達人',d:'一關入面裝備同小測都答啱'},siren:{ic:'🚨',name:'鳴笛開路',d:'有開警號，而且冇衝紅燈'},
  night:{ic:'🌙',name:'夜更英雄',d:'完成夜晚或者落雨嘅關卡'},yield:{ic:'🛣️',name:'有序開路',d:'一關入面響警號順利越過 5 架讓路車'},all:{ic:'🏅',name:'屯門元朗守護者',d:'完成全部關卡'}};
function ach(id){ const a=store.get('ach',{}); if(a[id]) return; a[id]=Date.now(); store.set('ach',a); S.newAch.push(id); }
/* ---------- 車款：救護車（黃／經典白）、救護電單車、警車、消防車、的士、巴士 ---------- */
// vmax 最高速、acc 加速倍數、steer 轉向、siren 有冇警號、lc 閃燈顏色、tone 警號音 [高,低,間隔ms]
// circ 車身碰撞圓心（沿車身）、kl/kw 車身長闊比例、nose 車頭距離車中心
const LIVERY=[
 {id:'yellow',kind:'amb',name:'救護車（標準黃色）',col:0xffe500,sw:'#ffe500',need:0,vmax:31,acc:1,steer:2.2,siren:true,lc:[0x3a88ff,0x3a88ff],tone:[960,770,560],circ:[-2.2,0,2.2],kl:1,kw:1,nose:2.6,d:'標準性能'},
 {id:'white',kind:'amb',name:'救護車（經典白色）',col:0xf4f6f8,sw:'#f4f6f8',need:4,vmax:31,acc:1,steer:2.2,siren:true,lc:[0x3a88ff,0x3a88ff],tone:[960,770,560],circ:[-2.2,0,2.2],kl:1,kw:1,nose:2.6,d:'舊款紅黃斜紋塗裝，標準性能'},
 {id:'moto',kind:'moto',name:'救護電單車',sw:'#d7ff2e',need:8,vmax:38,acc:1.35,steer:2.75,siren:true,lc:[0x3a88ff,0x3a88ff],tone:[960,770,560],circ:[-0.7,0.7],kl:0.42,kw:0.4,nose:1.4,d:'最快最靈活，藍色閃燈'},
 {id:'police',kind:'police',name:'警車',sw:'linear-gradient(#fff 35%,#d8202a 35%,#d8202a 50%,#1f4fbf 50%,#1f4fbf 70%,#fff 70%)',need:12,vmax:34,acc:1.15,steer:2.4,siren:true,lc:[0x3a88ff,0xff2a2a],tone:[1150,820,330],circ:[-1.9,0,1.9],kl:0.9,kw:0.9,nose:3.0,d:'快少少，紅藍閃燈'},
 {id:'fire',kind:'fire',name:'消防車',sw:'linear-gradient(#ffc400 30%,#d8202a 30%)',need:17,vmax:28,acc:0.85,steer:1.95,siren:true,lc:[0xff2a2a,0xff2a2a],tone:[720,540,640],circ:[-2.2,0,2.2],kl:1,kw:1,nose:3.3,d:'車身重、較慢，紅色閃燈'},
 {id:'taxi',kind:'taxi',name:'的士',sw:'#2bb04a',need:22,vmax:33,acc:1.1,steer:2.5,siren:false,lc:[0,0],tone:[0,0,500],circ:[-1.4,1.4],kl:0.7,kw:0.85,nose:2.25,d:'冇警號冇閃燈：其他車唔會讓路，要守交通燈'},
 {id:'bus',kind:'bus',name:'雙層巴士',sw:'#e8343a',need:27,vmax:24,acc:0.65,steer:1.6,siren:false,lc:[0,0],tone:[0,0,500],circ:[-3.4,-1.2,1.2,3.4],kl:1.45,kw:1,nose:4.5,d:'又大又慢、冇警號：最高難度'}];
let VSPEC=LIVERY[0], CURL=amb.userData.blues;
amb.add(amb.userData.pB,amb.userData.pR);   // 閃燈光源搬去車組，換車身都照用
const AMB_Y=[]; amb.traverse(o=>{ if(o.isMesh&&o.material&&o.material.color&&o.material.color.getHex()===0xffe500&&!AMB_Y.includes(o.material)) AMB_Y.push(o.material); });
const lamp=(w,h,d,col,on,par,x,y,z)=>{ const m=add(rbox(w,h,d,0.05),M(col),par,x,y,z,false); m.userData.on=on; return m; };
const ptex=(key,w,h,draw)=>vtex('pv'+key,w,h,draw);
const chev=(g,x0,y0,w,h,sw,c1,c2)=>{ g.save(); g.beginPath(); g.rect(x0,y0,w,h); g.clip(); for(let i=-2;i*sw<w+h;i++){ g.fillStyle=(i&1)?c1:c2; g.beginPath(); g.moveTo(x0+i*sw,y0+h); g.lineTo(x0+i*sw+h,y0); g.lineTo(x0+i*sw+h+sw,y0); g.lineTo(x0+i*sw+sw,y0+h); g.fill(); } g.restore(); };
const SKB={
 /* 消防車（輕型泵車款）：紅車身、黃色車頂邊、銀色捲閘、車頂紅色燈排 */
 fire(){ const g=new THREE.Group(); const red='#d8202a', yel='#ffc400';
  const side=f=>ptex('fireS'+f,1024,368,(c,W,H)=>{ const X=x=>f?x:W-x, R=(x0,y0,x1,y1)=>{ const a=X(x0),b=X(x1); c.fillRect(Math.min(a,b),y0,Math.abs(b-a),y1-y0); };
    c.fillStyle=red; c.fillRect(0,0,W,H); c.fillStyle=yel; c.fillRect(0,0,W,46);
    [[40,330],[350,640]].forEach(([a,b])=>{ c.fillStyle='#c9ced4'; R(a,70,b,300); c.fillStyle='rgba(0,0,0,.16)'; for(let y=78;y<300;y+=12) R(a,y,b,y+3); c.strokeStyle='#8a9098'; c.lineWidth=5; c.strokeRect(Math.min(X(a),X(b)),70,Math.abs(b-a),230); });
    c.fillStyle='#20262e'; R(700,74,790,170); R(830,74,990,180);                    // 後座窗、駕駛室窗
    c.strokeStyle='rgba(0,0,0,.3)'; c.lineWidth=4; c.strokeRect(Math.min(X(815),X(1000)),60,185,270);
    chev(c,Math.min(X(690),X(1010)),236,320,40,26,yel,red);
    c.fillStyle=yel; c.font='bold 30px sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText('RESCUE',X(910),208);
    c.fillStyle='rgba(0,0,0,.35)'; c.fillRect(0,H-26,W,26); });
  const front=ptex('fireF',256,236,(c,W,H)=>{ c.fillStyle=red; c.fillRect(0,0,W,H); c.fillStyle=yel; c.fillRect(0,0,W,28);
    c.fillStyle='#20262e'; c.fillRect(22,36,W-44,78); c.fillStyle=yel; c.fillRect(50,122,W-100,22); c.fillRect(34,150,W-68,24);
    c.fillStyle=red; c.font='bold 17px sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText('救 RESCUE 援',W/2,134); c.fillText('消 FIRE SERVICES 防',W/2,163);
    c.fillStyle='#16181c'; c.fillRect(60,182,W-120,34); c.fillStyle='#fff6d0'; c.fillRect(18,186,34,26); c.fillRect(W-52,186,34,26); });
  const rear=ptex('fireR',256,236,(c,W,H)=>{ c.fillStyle=red; c.fillRect(0,0,W,H); c.fillStyle=yel; c.fillRect(0,0,W,30); c.fillStyle='#c9ced4'; c.fillRect(30,40,W-60,150);
    c.fillStyle='rgba(0,0,0,.16)'; for(let y=46;y<190;y+=10) c.fillRect(30,y,W-60,3); c.strokeStyle='#e8ecef'; c.lineWidth=4; c.strokeRect(150,36,50,170); for(let y=52;y<200;y+=22){ c.beginPath(); c.moveTo(150,y); c.lineTo(200,y); c.stroke(); }
    c.fillStyle='#ff4040'; c.fillRect(10,196,30,18); c.fillRect(W-40,196,30,18); c.fillStyle=yel; c.fillRect(96,200,64,20); });
  const base=solid(0xd8202a);
  vbox(2.55,2.5,6.5,[side(true),side(false),base,base,front,rear],g,0,1.85,0);
  vbox(2.6,0.14,6.55,base,g,0,3.15,0,false);
  [-0.75,0.75].forEach(x=>{ const r=add(cyl(0.05,0.05,5.0,6),M(0xc9ced4),g,x,3.42,-0.6,false); r.rotation.x=Math.PI/2; });
  [-2.6,-1.4,-0.2,1.0].forEach(z=>add(new THREE.BoxGeometry(1.5,0.05,0.06),M(0xc9ced4),g,0,3.42,z,false));
  [[-1.1,-2.9],[1.1,-2.9],[-1.1,1.4],[1.1,1.4]].forEach(([x,z])=>add(cyl(0.04,0.04,0.3,6),M(0xc9ced4),g,x,3.3,z,false));
  const blues=[lamp(0.9,0.24,0.34,0xb81818,0xff1a1a,g,-0.62,3.36,2.7), lamp(0.9,0.24,0.34,0xb81818,0xff1a1a,g,0.62,3.36,2.7), lamp(0.5,0.2,0.2,0xb81818,0xff1a1a,g,-0.9,3.3,-3.1), lamp(0.5,0.2,0.2,0xb81818,0xff1a1a,g,0.9,3.3,-3.1)];
  { const s=new THREE.Mesh(new THREE.PlaneGeometry(0.5,0.2),new THREE.MeshBasicMaterial({map:tex([{t:'FIRE',f:'bold 44px sans-serif'}],'#ffffff','#d8202a',128,56)})); s.position.set(0,3.36,2.88); g.add(s); }
  wheelsAt(g,[[-1.15,2.05],[1.15,2.05],[-1.15,-1.95],[1.15,-1.95]],0.58,0.42); g.userData.blues=blues; return g; },
 /* 警車（白色客貨車）：紅藍紅腰帶、「警 POLICE 察」、車頂藍紅閃燈 */
 police(){ const g=new THREE.Group(); const red='#d8202a', blu='#1f3fa8';
  const side=f=>ptex('polS'+f,1024,400,(c,W,H)=>{ const X=x=>f?x:W-x, R=(x0,y0,x1,y1)=>{ const a=X(x0),b=X(x1); c.fillRect(Math.min(a,b),y0,Math.abs(b-a),y1-y0); };
    c.fillStyle='#f4f6f8'; c.fillRect(0,0,W,H);
    c.fillStyle='#20262e'; R(40,50,300,170); R(320,50,560,170); R(600,50,740,170); R(770,56,900,170);
    c.fillStyle='rgba(255,255,255,.14)'; for(let x=44;x<560;x+=14) R(x,50,x+3,170);     // 車窗鐵網
    c.fillStyle=red; R(0,196,930,300); c.fillStyle=blu; R(0,222,930,274);
    c.fillStyle='#fff'; c.font='bold 40px sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText(f?'警 POLICE 察':'警 POLICE 察',X(420),250);
    c.strokeStyle='rgba(0,0,0,.22)'; c.lineWidth=4; c.strokeRect(Math.min(X(590),X(750)),40,160,320); c.strokeRect(Math.min(X(760),X(910)),40,150,320);
    c.fillStyle='rgba(0,0,0,.3)'; c.fillRect(0,H-22,W,22); });
  const front=ptex('polF',256,200,(c,W,H)=>{ c.fillStyle='#f4f6f8'; c.fillRect(0,0,W,H); c.fillStyle=red; c.fillRect(0,20,W,50); c.fillStyle=blu; c.fillRect(0,32,W,26);
    c.fillStyle='#fff'; c.font='bold 22px sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText('POLICE',W/2,46);
    c.fillStyle='#16181c'; c.fillRect(70,92,W-140,50); c.fillStyle='#fff6d0'; c.fillRect(14,96,46,34); c.fillRect(W-60,96,46,34); c.fillStyle='#16181c'; c.fillRect(0,160,W,40); });
  const rear=ptex('polR',256,400,(c,W,H)=>{ c.fillStyle='#f4f6f8'; c.fillRect(0,0,W,H); c.fillStyle='#20262e'; c.fillRect(24,50,96,120); c.fillRect(136,50,96,120);
    c.fillStyle=red; c.fillRect(0,196,W,104); c.fillStyle=blu; c.fillRect(0,222,W,52); c.fillStyle='#fff'; c.font='bold 34px sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText('POLICE',W/2,250);
    c.fillStyle='#ff4040'; c.fillRect(6,310,22,50); c.fillRect(W-28,310,22,50); c.strokeStyle='rgba(0,0,0,.25)'; c.lineWidth=3; c.beginPath(); c.moveTo(W/2,30); c.lineTo(W/2,380); c.stroke(); });
  const wh=solid(0xf4f6f8), gl=M(C.glass,{r:0.2});
  vbox(2.3,2.3,5.2,[side(true),side(false),wh,wh,wh,rear],g,0,1.65,-0.45);
  vbox(2.28,1.15,0.95,[wh,wh,wh,wh,front,wh],g,0,1.08,2.6);
  const ws=add(new THREE.BoxGeometry(2.1,1.15,0.08),gl,g,0,2.18,2.36,false); ws.rotation.x=-0.5;
  const fill=add(new THREE.BoxGeometry(2.28,0.2,0.5),wh,g,0,2.72,2.0,false);
  const blues=[lamp(0.85,0.2,0.32,0x2f6bff,0x1550ff,g,-0.5,2.92,1.5), lamp(0.85,0.2,0.32,0xc22020,0xff1a1a,g,0.5,2.92,1.5), lamp(0.3,0.14,0.1,0xc22020,0xff1a1a,g,-0.6,1.42,3.09), lamp(0.3,0.14,0.1,0x2f6bff,0x1550ff,g,0.6,1.42,3.09)];
  add(new THREE.BoxGeometry(2.0,0.08,0.4),M(0x2b2d33),g,0,2.82,1.5,false);
  wheelsAt(g,[[-1.05,1.9],[1.05,1.9],[-1.05,-1.9],[1.05,-1.9]],0.5,0.38); g.userData.blues=blues; return g; },
 /* 救護電單車：螢光黃車身、紅色斜紋、尾箱生命之星、藍色閃燈 */
 moto(){ const g=new THREE.Group(); const Yf=M(0xd7ff2e,{r:0.4,e:0x1c2400}), dk=M(C.dark), red=M(0xe8202a);
  const pan=ptex('motoP',128,96,(c,W,H)=>{ c.fillStyle='#d7ff2e'; c.fillRect(0,0,W,H); chev(c,0,30,W,36,22,'#e8202a','#d7ff2e'); c.fillStyle='#1c1c1c'; c.fillRect(0,0,W,10); c.fillRect(0,H-10,W,10); });
  const topT=ptex('motoT',128,96,(c,W,H)=>{ c.fillStyle='#d7ff2e'; c.fillRect(0,0,W,H); c.fillStyle='#e8202a'; c.fillRect(0,H-26,W,26); drawStar(c,W/2,38,28); });
  [1.0,-1.0].forEach(z=>{ const w=add(cyl(0.44,0.44,0.2,16),dk,g,0,0.44,z); w.rotation.z=Math.PI/2; add(cyl(0.2,0.2,0.22,10),M(0xc9ced4),g,0,0.44,z,false).rotation.z=Math.PI/2; });
  add(rbox(0.42,0.5,1.05,0.1),M(0x5b6270),g,0,0.62,0.0);                      // 引擎
  add(rbox(0.62,0.5,1.0,0.18),Yf,g,0,1.08,0.38);                               // 油缸
  add(rbox(0.5,0.12,0.4,0.05),red,g,0,1.2,0.5,false);
  add(rbox(0.56,0.42,0.55,0.15),Yf,g,0,1.25,0.98);                             // 車頭罩
  add(rbox(0.3,0.16,0.3,0.06),Yf,g,0,0.95,1.3);                                // 鳥嘴
  const ws=add(new THREE.BoxGeometry(0.5,0.6,0.05),M(C.glass,{r:0.15,op:0.6}),g,0,1.72,1.02,false); ws.rotation.x=-0.35;
  add(sph(0.11),M(0xfff6c4,{e:0x554400}),g,0,1.3,1.27,false);
  const fk=add(cyl(0.05,0.05,0.95,8),M(0xc9ced4),g,0,0.85,1.05,false); fk.rotation.x=0.35;
  const hb=add(cyl(0.035,0.035,0.9,8),dk,g,0,1.5,0.72,false); hb.rotation.z=Math.PI/2;
  add(rbox(0.44,0.16,0.85,0.06),dk,g,0,1.02,-0.4);                             // 座位
  add(rbox(0.4,0.3,0.5,0.08),Yf,g,0,0.86,-1.0);                                // 尾殼
  [-1,1].forEach(s=>vbox(0.34,0.6,0.85,[pan,pan,solid(0x1c1c1c),solid(0x1c1c1c),pan,pan],g,s*0.5,0.86,-0.92));
  vbox(0.62,0.46,0.6,[topT,topT,solid(0xd7ff2e),solid(0xd7ff2e),topT,topT],g,0,1.42,-1.08);
  add(cyl(0.02,0.02,0.6,6),M(0x9aa1ab),g,0.26,1.95,-1.3,false);
  const blues=[lamp(0.14,0.18,0.14,0x2f6bff,0x1550ff,g,0.26,2.3,-1.3), lamp(0.16,0.12,0.1,0x2f6bff,0x1550ff,g,-0.34,1.42,1.08), lamp(0.16,0.12,0.1,0x2f6bff,0x1550ff,g,0.34,1.42,1.08)];
  // 救護員（頭盔）
  const r=person('crew'); r.scale.set(0.62,0.62,0.62); r.position.set(0,0.78,-0.38); r.rotation.x=0.12; g.add(r);
  r.children.forEach(o=>{ if(o.position.y>1.9) o.scale.multiplyScalar(0.01); });   // 收起大頭，換細頭盔
  const hm=add(sph(0.27),M(0xf4f6f8,{r:0.3}),g,0,1.98,-0.2); hm.scale.set(1,0.95,1.1); add(new THREE.BoxGeometry(0.36,0.13,0.08),M(C.glass,{r:0.1}),g,0,1.96,0.07,false);
  g.userData.blues=blues; return g; },
 /* 的士：綠色新界的士（同路面嗰款一樣），冇警號 */
 taxi(){ const g=new THREE.Group(); taxiModel(g,true); g.scale.setScalar(1.05); g.userData.blues=[]; return g; },
 /* 雙層巴士：紅色，縮細少少方便出入車房，冇警號 */
 bus(){ const r=Math.random; Math.random=()=>0; const g=busModel(); Math.random=r; g.scale.setScalar(0.78); g.userData.blues=[]; return g; }
};
const SKINS={};
function applyLivery(id){ const L=LIVERY.find(l=>l.id===id)||LIVERY[0]; VSPEC=L; const U=amb.userData, isAmb=L.kind==='amb';
  U.body.visible=isAmb; for(const k in SKINS) SKINS[k].visible=false;
  if(isAmb){ AMB_Y.forEach(m=>{ m.color.setHex(L.col); m.emissive.setHex(L.id==='white'?0x262626:0x3a3300); }); U.setClassic(L.id==='white'); CURL=U.blues; }
  else { let s=SKINS[L.kind]; if(!s){ s=SKINS[L.kind]=SKB[L.kind](); amb.add(s); s.position.set(0,0,0); s.rotation.set(0,0,0); s.traverse(o=>{ if(o.isMesh) o.castShadow=true; }); } s.visible=true; CURL=s.userData.blues; }
  U.pB.color.setHex(L.lc[0]||0x3a88ff); U.pR.color.setHex(L.lc[1]||0x3a88ff);
  const bh=$('bH'); bh.textContent=L.siren?'警號':'響咹'; bh.setAttribute('aria-label',L.siren?'警號開關':'響咹');
  try{ if(S.siren) sirenSet(false); }catch(e){}
  store.set('livery',L.id); }

function checkLiveryUnlock(){ const tot=totalStars(), seen=store.get('livSeen',0); const nu=LIVERY.filter(l=>l.need>seen&&l.need<=tot);
  if(nu.length){ $('rAch').innerHTML+=(($('rAch').innerHTML)?'<br>':'')+'<b>🚑 新車款：</b>'+nu.map(l=>l.name).join('、')+'（去「車款」換）'; } store.set('livSeen',Math.max(seen,tot)); }
applyLivery(store.get('livery','yellow'));

/* ---------- 排行榜：本機＋（如有）網上 ---------- */
let DB=null, UID=null;
(async()=>{ try{ if(typeof claude==='undefined'||!claude.use) return; const db=await claude.use('db'), u=await claude.use('user'); if(db&&u){ const id=await u.id(); if(id){ DB=db; UID=id; if(S.mode==='menu'&&S.tab==='board') renderMenu('board'); } } }catch(e){} })();
function rankSort(a,b){ return b.st-a.st||a.tm-b.tm; }
async function saveScore(){ const n=($('rName').value||'').trim().slice(0,12)||(S.gm==='taxi'?'無名司機':S.gm==='chase'?'無名車手':'無名救護員'); store.set('name',n); const lv=S.level.id; const rec={n,st:S.stars,tm:Math.round(S.tHosp),d:Date.now()};
  const lb=store.get('lb',{}); lb[lv]=(lb[lv]||[]).concat([rec]).sort(rankSort).slice(0,5); store.set('lb',lb);
  $('rSave').disabled=true; $('rSave').textContent='已儲存 ✓';
  if(DB&&UID){ try{ const ref=DB.doc('board/'+UID); const cur=await ref.get(); const body=cur.exists?JSON.parse(JSON.stringify(cur.data())):{lv:{}};
      body.n=n; body.lv=body.lv||{}; const old=body.lv[lv]; if(!old||rankSort(rec,old)<0) body.lv[lv]={st:rec.st,tm:rec.tm}; await ref.set(body); $('rSave').textContent='已儲存（網上）✓'; }catch(e){} } }
$('rSave').onclick=saveScore;
async function onlineBoard(lv,box){ if(!DB){ box.textContent='（網上排行榜：分享俾朋友，佢哋有「可使用」權限就可以一齊上榜）'; return; }
  box.textContent='載入緊…'; let done=false; const tmo=setTimeout(()=>{ if(!done) box.textContent='暫時連唔到網上排行榜'; },10000);
  try{ const q=await DB.collection('board').limit(300).get(); done=true; clearTimeout(tmo);
    const rows=q.docs.map(d=>{ const v=d.data()||{}; const r=v.lv&&v.lv[lv]; return r?{n:String(v.n||'無名').slice(0,12),st:+r.st||0,tm:+r.tm||0,me:d.id===UID}:null; }).filter(Boolean).sort(rankSort).slice(0,10);
    box.textContent=''; if(!rows.length){ box.textContent='暫時未有人上榜，做第一個！'; return; } box.append(boardTable(rows)); }catch(e){ done=true; clearTimeout(tmo); box.textContent='暫時連唔到網上排行榜'; } }
function boardTable(rows){ const t=document.createElement('table'); t.className='board'; rows.forEach((r,i)=>{ const tr=t.insertRow(); const c0=tr.insertCell(); c0.textContent=(i+1)+'.';
  const c1=tr.insertCell(); c1.className='n'; c1.textContent=r.n+(r.me?'（你）':''); const c2=tr.insertCell(); const isT=S.boardLv==='TAXI'&&S.mode==='menu'; if(isT) c2.textContent='$'+r.st; else c2.innerHTML=[...Array(r.st)].map(()=>'<i class="on">'+lifeStar(13)+'</i>').join(''); c2.style.color=isT?'#1f8f3a':'#ff3b5c';
  const isC=S.boardLv==='CHASE'&&S.mode==='menu'; if(isC&&!r.st){ c2.textContent='💔'; }
  const c3=tr.insertCell(); c3.className='r'; c3.textContent=isT?'':isC?'撐 '+(60-r.tm)+' 秒':fmt(r.tm); }); return t; }

/* ---------- 選單 ---------- */
function renderMenu(tab){ if(!tab&&!S.tab){ const o=store.get('openTab',null); if(o){ store.set('openTab',null); tab=o; } } tab=tab||S.tab||'levels'; S.tab=tab; const B=$('tabBody'); B.innerHTML='';
  document.querySelectorAll('#tabs button').forEach(b=>{ b.setAttribute('aria-selected',b.dataset.t===tab); b.onclick=()=>renderMenu(b.dataset.t); });
  const best=bestStars(), el=(tag,cls,txt)=>{ const e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; };
  if(S.unlockMsg){ S.unlockMsg=false; B.append(el('p','ach-new','🔓 已解鎖全部關卡、知識卡同車款！')); }
  if(tab==='levels'){ const RMODE=REGION==='st'?'st':REGION==='sr'?'sr':'ems'; S.menuMode=S.menuMode||store.get('menuMode',RMODE); if(S.menuMode!=='real'&&S.menuMode!=='pc'&&S.menuMode!=='sim'&&((S.menuMode==='st'||S.menuMode==='sr')?S.menuMode:'tm')!==REGION) S.menuMode=RMODE;
    const MODES=[['ems','🚑','救護任務',true],['real','🎬','寫實模式',true],['pc','🖥️','電腦模式',true],['sim','🩺','現場模擬',true],['taxi','🚕','的士接客',true],['chase','🚓','追逐模式',true],['free','🚶','自由探索',true],['cpr','❤️','CPR（測試）',true],['st','🏥','沙田救護任務\n（簡單）',true],['sr','🗺️','沙田救護任務\n（困難）',!!window.SR_OK]];
    const mr=el('div','modes'); MODES.forEach(([id,ic,nm,on])=>{ const b=el('button','mode'+(S.menuMode===id?' on':'')); b.disabled=!on; b.append(el('span','mi',ic),(bb=>{ if(nm.includes('\n')){ bb.style.whiteSpace='pre-line'; bb.style.textAlign='center'; bb.style.lineHeight='1.25'; } return bb; })(el('b',null,nm)),el('small',null,on?'':'即將推出')); b.onclick=()=>{ const need=id==='st'?'st':id==='sr'?'sr':id==='real'||id==='pc'||id==='sim'?REGION:'tm'; if(id==='pc'&&GFX<3){ store.set('gfxPrev',store.get('gfx',2)); store.set('gfx',3); store.set('menuMode','pc'); B.innerHTML='<p style="text-align:center;padding:30px 0">🖥️ 載入「電腦」畫質（GTA 式高樓、玻璃反光）……</p>'; setTimeout(()=>location.reload(),60); return; } if(need!==REGION){ store.set('region',need); store.set('menuMode',id); B.innerHTML='<p style="text-align:center;padding:30px 0">🗺️ 載入'+(need==='st'?'沙田':need==='sr'?'沙田實景':'屯門')+'地圖中……</p>'; setTimeout(()=>location.reload(),60); return; } S.menuMode=id; store.set('menuMode',id); renderMenu('levels'); }; mr.append(b); }); B.append(mr);
    if(S.menuMode==='sim'){ SIM.menu(B,el); return; }
    if(S.menuMode==='taxi'){ B.append(el('p',null,'60 秒內不停接客送客！停喺乘客旁邊就上車，跟橙色導航線送到目的地。'));
      const lg=el('div','txleg'); [['o','橙色','近程','$10','+5 秒'],['y','黃色','中程','$25','+8 秒'],['g','綠色','遠程','$50','+12 秒']].forEach(([k,n,dd,m,s])=>{ const r=el('div'); const dot=el('span','dot'); dot.style.background=TX.cls[k].css; r.append(dot,el('b',null,n+' '+dd),el('span',null,m+' · '+s)); lg.append(r); }); B.append(lg);
      B.append(el('p',null,'提早送到有貼士。撞車、撞人、衝紅燈都冇罰，只會慢落嚟。'));
      B.append(el('p','txbest','最高紀錄：$'+store.get('taxiBest',0)));
      const go=el('button','go','🚕 開始接客'); go.onclick=()=>startTaxi(); B.append(go); return; }
    if(S.menuMode==='cpr'){ B.append(el('p',null,'行街時見到有人突然暈低、不省人事，你識唔識救？跟消防處 CPR 同 AED 教材，由確定環境安全開始，一步一步練習。'));
      const ul=el('ul','chlist'); ['① 冷靜：確定現場環境安全','② 檢查：輕拍膊頭、大聲叫，確定人事不省','③ 召喚：叫途人幫手打 999、攞 AED','④ 打開氣道，用少過 10 秒檢查呼吸','⑤ CPR：每分鐘 100–120 下，壓 5–6 公分','⑥ AED：開機 → 貼電極片 → 分析及電擊'].forEach(x=>ul.append(el('li',null,x))); B.append(ul);
      const g1=el('button','go','📖 教學模式'); g1.style.background='#e0465e'; g1.onclick=()=>startCPR('teach',false); B.append(g1);
      B.append(el('p',null,'教學模式：每一步有解說同提示（單純按壓式 CPR）。練習模式：冇提示，做錯先會提醒你。'));
      const row=el('div','cpsel'); let br=store.get('cprBreaths',false); const mk=(v,t)=>{ const b=el('button',br===v?'on':'',t); b.onclick=()=>{ store.set('cprBreaths',v); renderMenu('levels'); }; return b; };
      row.append(mk(false,'單純按壓'),mk(true,'30 按壓 + 2 人工呼吸')); B.append(el('p',null,'練習模式按壓方式：')); B.append(row);
      const g2=el('button','go','🫀 練習模式'); g2.style.background='#c2185b'; g2.onclick=()=>startCPR('practice',br); B.append(g2); return; }
    if(S.menuMode==='free'){ B.append(el('p',null,'冇時間限制、冇計分，喺屯門同元朗周圍行，見到咩車都可以上去揸！'));
      const ul=el('ul','chlist'); ['行近任何一部車撳「上車」：路上嘅車司機會自己落車行開','路邊泊咗救護車、警車、消防車、救護電單車俾你試','停定車撳「落車」，架車會泊喺原位，可以再上','手機：左下角搖桿行路，右下角「跳」「上車」','電腦：WASD 行路，空白鍵跳，E 上落車，滑鼠拉動轉鏡頭'].forEach(x=>ul.append(el('li',null,x))); B.append(ul);
      const go=el('button','go','🚶 開始探索'); go.style.background='#7b4fd6'; go.onclick=()=>startFree(); B.append(go); return; }
    if(S.menuMode==='chase'){ const L=LIVERY.find(l=>l.id===store.get('livery','yellow'))||LIVERY[0];
      B.append(el('p',null,'警車開住警號追你！喺隨機地點開始，撐夠 60 秒就成功逃脫。'));
      const ul=el('ul','chlist'); ['有 5 粒生命之星：撞到警車或者路障扣 1 粒，扣晒就被捕','每 12 秒多一架警車，最多 6 架；路障越嚟越多','路障留咗一條窄位，可以鑽過去','撞到人唔扣分，佢哋會彈開再起身','開警號，路上啲車會讓路'].forEach(x=>ul.append(el('li',null,x))); B.append(ul);
      B.append(el('p',null,'使用車款：'+L.name+'（喺「車款」分頁可以換）'));
      const cb=store.get('chaseBest',{st:0,s:0}); B.append(el('p','txbest','最佳紀錄：'+(cb.st?cb.st+' 粒生命之星逃脫':cb.s?'撐 '+cb.s+' 秒':'未有')));
      const go=el('button','go','🚓 開始追逐'); go.style.background='#1f4fbf'; go.onclick=()=>startChase(); B.append(go); return; }
    if(S.menuMode==='pc') B.append(el('p','realIntro','🖥️ 電腦模式：寫實模式再升級，專為電腦而設。GTA 式畫面——香港日頭清爽陽光、夜晚霓虹藍紫配黃色街燈；玻璃幕牆寫字樓、私人屋苑、十字型公屋、工廈、酒店、商場同停車場，天台有廣告牌同航空燈。操作掣縮細，字幕喺救護車下面。鍵盤：W／S／A／D 或方向鍵、H 警號、M 地圖、V 視線、Enter 接受派遣、1–4 答題；滑鼠拖曳轉鏡頭、滾輪縮放。'+(GFX<3?'':'')));
    if(S.menuMode==='real') B.append(el('p','realIntro','🎬 寫實模式：電影感黃昏光影、光暈同調色、低鏡頭跟車，加上派遣接 Call（RES 接受／REJ 拒絕）、圓形小地圖、狀態條、分數同時鐘。用嘅係'+(REGION==='sr'?'沙田實景':REGION==='st'?'沙田':'屯門')+'嘅關卡（要較新嘅手機）。'));
    if(S.menuMode==='st'&&REGION==='st') B.append(el('p','realIntro','🏥 沙田救護任務（簡單）：簡化沙田地圖，題目係一般急救常識（唔涉及消防處 Protocol），小朋友同一般市民都答到。'));
    if(REGION==='sr') B.append(el('p','realIntro','🗺️ 沙田救護任務（困難）：題目跟救護員 Protocol（藥物、分流），地圖由 OpenStreetMap 真實資料生成——城門河、馬路走向、約 2,000 座樓宇嘅真實位置同形狀（縮細比例）。由源禾路沙田救護站（隔籬係沙田區消防總局同直升機坪）出車，個案地點全部係沙田真實地址，送去威爾斯親王醫院急症室。地圖資料 © OpenStreetMap 貢獻者（ODbL 授權）。'));
    B.append(el('p',null,REGION==='sr'?'完成一關解鎖下一關：':REGION!=='tm'?'沙田區：由沙田或者田心救護站出車，到場處理，再送去威爾斯親王醫院急症室。完成一關解鎖下一關：':'由屯門救護站出車，到場處理，再送去屯門醫院急症室。完成一關解鎖下一關：'));
    if(S.menuMode==='ems'){ const tb=el('button','go','🎓 新手教學（第一次玩建議先試）'); tb.style.cssText='background:#ffb703;color:#3a2a00;margin:0 0 10px'; tb.onclick=()=>{ S.realPick=false; S.pcPick=false; S.tutPick=true; startCase(0); }; B.append(tb); }
    const box=el('div'); box.id='cases'; LEVELS.forEach((lv,i)=>{ const k=caseOf(lv), lock=!unlockedAll()&&i>0&&!isDone(LEVELS[i-1].id), st=best[lv.id]||0;
      const b=el('button','case'+(lock?' locked':'')); b.disabled=lock;
      b.append((()=>{ const x=el('span','pl','第 '+(i+1)+' 關 · '+lv.todName+(lv.works?' · 修路':'')+(lv.jam?' · 塞車':'')); if(isDone(lv.id)) x.insertAdjacentHTML('beforeend',PLAY.chalHTML(lv.id)); return x; })(), el('b',null,(lock?'🔒 ':'')+k.place+'：'+k.title), (()=>{ const x=el('span','st'); x.innerHTML=[0,1,2,3,4].map(i=>'<i class="'+(i<st?'on':'off')+'">'+lifeStar(14)+'</i>').join(''); return x; })());
      if(lv.support&&lv.support.length) b.append(el('span','sup',supTags(lv).join(' · ')));
      b.onclick=()=>{ S.realPick=S.menuMode==='real'||S.menuMode==='pc'; S.pcPick=S.menuMode==='pc'; startCase(i); }; box.append(b); }); B.append(box);
    const r=el('div','rules'); r.innerHTML='<b>點玩：</b>◀ ▶ 轉彎，按住「油」前進，「倒」倒車；撳「警號」開閃燈同警號，其他車會讓路，可以安全過紅燈。<br><b>限時：</b>準時到 +1 生命之星，超時 −1 生命之星。<br><b>生命之星：</b>5 粒；撞車、撞樓、撞人、冇警號衝紅燈、揀錯裝備、答錯小測、病人穩定度跌晒，每次 −1 生命之星，扣晒遊戲結束。<br><b>送院：</b>轉彎同煞車要慢慢嚟，保持病人穩定。'; B.append(r); }
  if(tab==='cards'){ B.append(el('p',null,'完成關卡就收集到嗰個個案嘅急救知識卡：'));
    LEVELS.forEach((lv,i)=>{ const k=caseOf(lv), d=el('div','kcard'+(isDone(lv.id)||unlockedAll()?'':' lock'));
      if(isDone(lv.id)||unlockedAll()){ d.append(el('b',null,'📗 '+k.title+'（'+k.place+'）')); const ul=el('ul'); k.tips.forEach(t=>ul.append(el('li',null,t))); d.append(ul); }
      else d.append(el('b',null,'🔒 完成第 '+(i+1)+' 關解鎖')); B.append(d); }); }
  if(tab==='ach'){ const got=store.get('ach',{}); B.append(el('p',null,'已解鎖 '+Object.keys(got).length+' / '+Object.keys(ACH).length+' 個成就'));
    const l=el('div','achl'); Object.entries(ACH).forEach(([id,a])=>{ const d=el('div','achi'+(got[id]?'':' lock')); d.append(el('span','ic',got[id]?a.ic:'🔒')); const t=el('div'); t.append(el('b',null,a.name),el('small',null,a.d)); d.append(t); l.append(d); }); B.append(l); }
  if(tab==='board'){ const sel=el('div','lvsel'); S.boardLv=S.boardLv||LEVELS[0].id; LEVELS.forEach((lv,i)=>{ const b=el('button',lv.id===S.boardLv?'on':null,'第'+(i+1)+'關'); b.onclick=()=>{ S.boardLv=lv.id; renderMenu('board'); }; sel.append(b); }); { const b=el('button',S.boardLv==='TAXI'?'on':null,'🚕 的士'); b.onclick=()=>{ S.boardLv='TAXI'; renderMenu('board'); }; sel.append(b); }
    { const b=el('button',S.boardLv==='CHASE'?'on':null,'🚓 追逐'); b.onclick=()=>{ S.boardLv='CHASE'; renderMenu('board'); }; sel.append(b); } B.append(sel);
    B.append(el('div','bhead','📱 呢部機嘅紀錄')); const lb=store.get('lb',{})[S.boardLv]||[]; if(lb.length) B.append(boardTable(lb)); else B.append(el('p',null,'未有紀錄。完成關卡後喺結算畫面儲存。'));
    B.append(el('div','bhead','🌐 網上排行榜')); const ob=el('div'); B.append(ob); onlineBoard(S.boardLv,ob); }
  if(tab==='set'){ const C=ANI.cfg(), save=()=>{ ANI.setCfg(C); renderMenu('set'); };
    const sec=t=>B.append(el('h3','set-h',t));
    const row=(lab,ctrl,sub)=>{ const r=el('div','set-row'); const l=el('div','set-l'); l.append(el('b',null,lab)); if(sub) l.append(el('small',null,sub)); r.append(l,ctrl); B.append(r); return r; };
    const sw=(on,fn,label)=>{ const b=el('button','set-sw'+(on?' on':''),on?'開':'關'); b.setAttribute('role','switch'); b.setAttribute('aria-checked',on); b.setAttribute('aria-label',label); b.disabled=['飛機','麻鷹'].includes(label)&&!C.on; b.onclick=()=>{ fn(!on); save(); }; return b; };
    const step=(v,mn,mx,fn,label)=>{ const w=el('div','set-step'); const m=el('button',null,'－'), p=el('button',null,'＋'), n=el('span',null,String(v));
      m.setAttribute('aria-label',label+'減少'); p.setAttribute('aria-label',label+'增加'); m.disabled=v<=mn||!C.on; p.disabled=v>=mx||!C.on; m.onclick=()=>{ fn(v-1); save(); }; p.onclick=()=>{ fn(v+1); save(); }; w.append(m,n,p); return w; };
    if(FUN.unlocked){ sec('🎉 歡樂模式');
      row('歡樂模式',sw(FUN.on,v=>{ funSet(v); },'歡樂模式'),'全車解放、撞人噴血、撞車爆炸、🚀 氮氣、唔扣生命之星（唔計正式成績）');
      if(FUN.on) B.append(el('p','set-warn','🎉 開咗：所有車款可以揀；揸車時右邊有 🚀 掣（鍵盤 Shift）。歡樂分 '+FUN.score.toLocaleString())); }
    sec('🔤 提示字體大小');
    { const cur=store.get('fontSz',0), segs=el('div','set-seg'); [['小','預設'],['中','大少少'],['大','最易睇']].forEach(([t,d],v)=>{ const b=el('button','set-segb'+(cur===v?' on':'')); b.append(el('b',null,t),el('small',null,d)); b.setAttribute('aria-pressed',cur===v);
        b.onclick=()=>{ store.set('fontSz',v); applyFontSz(); renderMenu('set'); }; segs.append(b); }); B.append(segs); }
    sec('🚑 駕駛');
    row('真實設定',sw(DRV.real,v=>{ DRV.setReal(v); },'真實設定'),DRV.real?'開：好似自動波車。撳 D／R 掣轉波（要停定車），踩「油」先會郁，「煞」煞車；左邊軚盤左右滑動轉彎，放手自動回正。鍵盤 ↑ 油、↓ 煞、R 轉波、← → 扭軚；手掣 RT 油、LT 煞、Y 轉波、左搖桿扭軚（大地圖改用 Back）':'關：用 ◀ ▶ 轉彎，「油」前進，「倒」煞車／倒車');
    row('倒車動畫',sw(DRV.rev,v=>{ DRV.setRev(v); },'倒車動畫'),DRV.rev?'開：倒車前救護員由左邊落車行去車尾睇後，佢到咗先可以倒；轉返向前時要等佢跑返上車頭':'關：即刻可以倒車');
    sec('🚶 行人');
    row('行人自動避開',sw(DODGE.on,v=>{ DODGE.on=v; store.set('dodge',v); },'行人自動避開'),DODGE.on?'開：撞埋去之前行人會自己跳開，唔會受傷，亦唔扣生命之星':'關：撞到行人會瞓喺地下，一陣後消失（會扣生命之星）');
    sec('🖼️ 畫面質素');
    { const cur=store.get('gfx',2), segs=el('div','set-seg'); [['標準','最順，舊手機都得'],['精細','欄杆、街道設施、霓虹招牌'],['超精細','再多招牌同細節，新手機用'],['電腦','GTA 式高樓、玻璃反光，電腦用']].forEach(([t,d],v)=>{ const b=el('button','set-segb'+(cur===v?' on':'')); b.append(el('b',null,t),el('small',null,d)); b.setAttribute('aria-pressed',cur===v);
        b.onclick=()=>{ if(cur===v) return; store.set('gfx',v); store.set('openTab','set'); B.innerHTML='<p style="text-align:center;padding:30px 0">🖼️ 轉做「'+t+'」，重新載入地圖中……</p>'; setTimeout(()=>location.reload(),60); }; segs.append(b); });
      const r=el('div','set-row set-col'); const l=el('div','set-l'); l.append(el('b',null,'畫面細節'),el('small',null,'轉模式會重新載入地圖')); r.append(l,segs); B.append(r); }
    { const cur=!!store.get('pcBars',false), segs=el('div','set-seg'); [['關','全畫面'],['開','上下黑邊，電影感']].forEach(([t,d],v)=>{ const b=el('button','set-segb'+(+cur===v?' on':'')); b.append(el('b',null,t),el('small',null,d)); b.onclick=()=>{ PC.setBars(!!v); renderMenu('set'); }; segs.append(b); });
      const r=el('div','set-row set-col'); const l=el('div','set-l'); l.append(el('b',null,'🎞️ 電腦模式電影黑邊'),el('small',null,'只喺電腦模式生效')); r.append(l,segs); B.append(r); }
    { const cur=!!store.get('simShuffle',false), segs=el('div','set-seg'); [['關','按流程次序排列'],['開','打亂次序，要自己記流程']].forEach(([t,d],v)=>{ const b=el('button','set-segb'+(+cur===v?' on':'')); b.append(el('b',null,t),el('small',null,d)); b.onclick=()=>{ store.set('simShuffle',!!v); renderMenu('set'); }; segs.append(b); });
      const r=el('div','set-row set-col'); const l=el('div','set-l'); l.append(el('b',null,'🩺 現場模擬：打亂程序按鈕'),el('small',null,'左邊 RSE、LOC、D、CAB… 按鈕嘅排列')); r.append(l,segs); B.append(r); }
    sec('🐾 城市動物');
    row('生成動物',sw(C.on,v=>C.on=v,'生成動物'),'行人路、河上同天空嘅動物');
    row('地上動物數量',step(C.ground,1,12,v=>C.ground=v,'地上動物數量'),'同一時間最多幾多隻（落雨減半）');
    row('鴨仔隊數',step(C.ducks,0,4,v=>C.ducks=v,'鴨仔隊數'),'河同湖上面，夜晚唔會出');
    const chips=el('div','set-chips'); [['cat','🐱 貓'],['dog','🐶 狗'],['pigeon','🕊️ 白鴿'],['sparrow','🐦 麻雀'],['cow','🐄 黃牛']].forEach(([k,t])=>{ const b=el('button','set-chip'+(C.types[k]?' on':''),t); b.disabled=!C.on; b.setAttribute('aria-pressed',C.types[k]); b.onclick=()=>{ C.types[k]=!C.types[k]; save(); }; chips.append(b); });
    row('出現邊啲動物',chips,'黃牛只會喺屯門郊區出現');
    sec('✈️ 天空');
    row('飛機',sw(C.plane&&C.on,v=>C.plane=v,'飛機'),'每一兩分鐘飛過一次');
    row('麻鷹／遊隼',sw(C.kite&&C.on,v=>C.kite=v,'麻鷹'),'日間晴天喺天上打圈、俯衝');
    if(C.ground>8) B.append(el('p','set-warn','⚠️ 數量好多時，舊款手機可能會慢少少。'));
    const rs=el('button','sec wide','還原預設'); rs.onclick=()=>{ ANI.setCfg(JSON.parse(JSON.stringify(ANI.def))); renderMenu('set'); }; B.append(rs);
    sec('🔐 PIN 及聲明');
    { const lg=el('button','sec wide','📜 顯示免責聲明'); lg.onclick=showLegal; B.append(lg);
      const pb=el('button','sec wide','🔒 返回 PIN 畫面'); let armed=false; pb.onclick=()=>{ if(!armed){ armed=true; pb.textContent='再撳一次確認（之後要重新輸入 PIN）'; setTimeout(()=>{ armed=false; pb.textContent='🔒 返回 PIN 畫面'; },4000); return; }
        try{ localStorage.removeItem('pinGate.ok'); }catch(e){} store.set('openTab','levels'); location.reload(); }; B.append(pb); }
    B.querySelectorAll('.set-row').forEach((r,i)=>{ if(i>1&&!C.on) r.classList.add('dim'); }); }
  if(tab==='livery'){ const tot=totalStars(), cur=(LIVERY.find(l=>l.id===store.get('livery','yellow'))||LIVERY[0]).id; B.append(el('p',null,'累積最佳生命之星數：'+tot+' 粒。儲夠星數就解鎖新車款，每款性能唔同：'));
    LIVERY.filter(l=>!l.hidden).forEach(L=>{ const lock=tot<L.need&&!unlockedAll()&&!FUN.on; const b=el('button','liv'+(L.id===cur?' on':'')); b.disabled=lock; const sw=el('span','sw'); sw.style.background=L.sw;
      const bar=n=>'●'.repeat(n)+'○'.repeat(5-n), sp=Math.max(1,Math.min(5,Math.round((L.vmax-20)/3.6))), ag=Math.max(1,Math.min(5,Math.round((L.steer-1.3)/0.29)));
      const t=el('div'); t.append(el('b',null,L.name+(L.id===cur?'（使用中）':'')),el('small',null,lock?' 🔒 需要 '+L.need+' 粒生命之星':' 已解鎖'),el('br'),el('small',null,'速度 '+bar(sp)+'　靈活 '+bar(ag)+'　'+(L.siren?'有警號':'冇警號')),el('br'),el('small',null,L.d)); b.append(sw,t); b.onclick=()=>{ applyLivery(L.id); renderMenu('livery'); }; B.append(b); }); }
}

/* ---------- 交通意外現場：青山公路（巴士同小巴相撞） ---------- */
LMK.crash=REGION!=='tm'?null:(()=>{ const E=nearestEdge(...RP(330,300),r=>r.name==='青山公路'); const ux=-E.nz, uz=E.nx; // 行車方向：現場喺左手邊
  const lo=laneOff(E.r), R=E.R, P=(a,b)=>[R[0]+ux*a+E.nx*b,R[1]+uz*a+E.nz*b];
  return {stop:P(-6,lo),patient:P(4,E.r.w/2+2),ux,uz,nx:E.nx,nz:E.nz,P,w:E.r.w}; })();
const SCN={meshes:[],statics:[]};
function staticVeh(m,x,z,a){ m.position.set(x,0.1,z); m.rotation.y=a; const o={m,stuck:true,road:null,pose:{x,z,a},id:800+SCN.statics.length}; cars.push(o); SCN.statics.push(o); return o; }
function setupScene(k,lv){ clearScene();
  if(k.id==='crash'){ const C0=LMK.crash, P=C0.P, base=Math.atan2(C0.ux,C0.uz);
    const bp=P(16,laneOff({t:'main',w:C0.w})); staticVeh(carModel('bus'),bp[0],bp[1],base+0.35);
    const mp=P(23,-1.5); staticVeh(carModel('minibus'),mp[0],mp[1],base-1.25);
    for(let i=0;i<14;i++){ const d=P(18+Math.random()*7,Math.random()*6-2); const g=add(new THREE.BoxGeometry(0.3+Math.random()*0.5,0.08,0.3+Math.random()*0.5),M([0xd8dde3,0x9aa1aa,0xffd23f][i%3]),scene,d[0],0.2,d[1],false); g.rotation.y=Math.random()*3; SCN.meshes.push(g); } // 碎片
    [P(4,C0.w/2-1),P(32,C0.w/2-1)].forEach(p=>{ const t=add(new THREE.ConeGeometry(0.45,0.9,3),M(0xff3b30),scene,p[0],0.6,p[1],false); SCN.meshes.push(t); }); // 警告三角
    for(let i=0;i<3;i++){ const pp=person('bystander'); const q=P(20+i*2.5,C0.w/2+2.5); pp.position.set(q[0],0.2,q[1]); pp.rotation.y=Math.random()*6; SCN.meshes.push(pp); } }
  if(k.id==='mass'){ const P0=LMK.plaza.patient; const col=[0xe8323c,0xffc21a,0x21b46b,0xffc21a,0x21b46b];
    for(let i=0;i<5;i++){ const lp=lyingPatient(); const x=P0[0]+Math.cos(i*1.3)*(4+i*1.2), z=P0[1]+Math.sin(i*1.3)*2.2; lp.position.set(x,0.3,z); lp.rotation.set(0,Math.random()*6,0);
      lp.userData.blanket.visible=false; lp.userData.p.position.set(0,0.5,1.2); lp.userData.p.rotation.set(-Math.PI/2,0,0);
      add(new THREE.BoxGeometry(0.5,0.05,0.35),new THREE.MeshBasicMaterial({color:col[i]}),lp,0,0.95,0.6,false); SCN.meshes.push(lp); }
    for(let i=0;i<4;i++){ const pp=person('bystander'); pp.position.set(P0[0]-6+i*3,0.2,P0[1]+3.5); pp.rotation.y=Math.random()*6; SCN.meshes.push(pp); } } }
function clearScene(){ SCN.meshes.forEach(m=>scene.remove(m)); SCN.meshes.length=0; SCN.statics.forEach(o=>{ scene.remove(o.m); const i=cars.indexOf(o); if(i>=0) cars.splice(i,1); }); SCN.statics.length=0; clearEscorts(); }

/* ---------- 大量傷者：其他救護車由救護站一齊出發 ---------- */
const ESC=[];
function clearEscorts(){ S.supQ=null; HELP.clear(); ESC.forEach(e=>{ if(e.parked){ const h=e.parked.home; e.m.position.set(h[0],0.34,h[1]); e.m.rotation.y=h[2]; e.m.visible=true; e.m.userData.blues.forEach(b=>b.material.emissive.setHex(0)); } else scene.remove(e.m); }); ESC.length=0; }
const ESC_NO=['A319','A167','A203','A256'];
function launchEscorts(n){ const R=S.escRoute; if(!R) return;
  // 車隊：先係門口兩架（A245、A272），再由車房出其他救護車；行靠近中線嗰邊，方便其他車靠邊讓路
  const units=[...PARKED.map(p=>({m:p.m,start:[p.home[0],p.home[1]],parked:p}))];
  for(let i=0;units.length<n;i++){ const m=ambulance(ESC_NO[i%ESC_NO.length]); m.userData.body.scale.setScalar(0.85); m.userData.pB.intensity=0; m.userData.pR.intensity=0; m.userData.pB.visible=m.userData.pR.visible=false; m.userData.len=6; m.visible=false; units.push({m,start:DEPOT.pos.slice()}); }
  units.slice(0,n).forEach((u,i)=>{ const stopAt=Math.max(20,R.len-11*(i+1)); const pts=[], cum=[];
    for(let j=0;j<R.pts.length;j++){ if(R.cum[j]<=stopAt){ pts.push(R.pts[j].slice()); cum.push(R.cum[j]); } else { const A=R.pts[j-1],B=R.pts[j],k=(stopAt-R.cum[j-1])/((R.cum[j]-R.cum[j-1])||1); pts.push([A[0]+(B[0]-A[0])*k,A[1]+(B[1]-A[1])*k]); cum.push(stopAt); break; } }
    for(let j=1;j<pts.length-1;j++){ const [ux,uz]=dirn(pts[j-1],pts[j+1]); pts[j]=[pts[j][0]-uz*1.6,pts[j][1]+ux*1.6]; } // 向中線靠 1.6 米
    pts[0]=u.start.slice(); for(let j=1;j<pts.length;j++) cum[j]=cum[j-1]+Math.hypot(pts[j][0]-pts[j-1][0],pts[j][1]-pts[j-1][1]);
    ESC.push({m:u.m,pts,cum,s:0,delay:1+i*3.2,v:0,pose:null,done:false,parked:u.parked}); });
  toast('🚑 救護車隊跟住你出發！'); }
/* 支援單位：交通意外 → 警車；危及生命 → 救護電單車；部分關卡 → 消防車（先遣急救員）。救護車出咗車房先喺後面出現，一齊去現場 */
const SUP={police:{nm:'👮 警車',tag:'👮 警車協助',arr:'👮 警察到場協助',sp:15,mk:()=>SKB.police(),len:6},
  moto:{nm:'🏍️ 救護電單車',tag:'🏍️ 救護電單車協助',arr:'🏍️ 救護電單車到場',sp:36,fast:true,mk:()=>SKB.moto(),len:2.4},
  fire:{nm:'🚒 消防車',tag:'🚒 先遣急救員（消防）',arr:'🚒 先遣急救員到場',sp:33,fast:true,mk:()=>SKB.fire(),len:6.8}};
function supTags(lv){ return (lv.support||[]).map(k=>SUP[k].tag); }
function launchSupport(list){ const R=S.route; if(!R||!list||!list.length) return; const c=S.car, fx=Math.sin(c.a), fz=Math.cos(c.a);
  let j0=1, bd=1e9; for(let j=1;j<R.pts.length;j++){ const A=R.pts[j-1],B=R.pts[j],dx=B[0]-A[0],dz=B[1]-A[1],L2=dx*dx+dz*dz||1; const k=Math.max(0,Math.min(1,((c.x-A[0])*dx+(c.z-A[1])*dz)/L2)); const d=(A[0]+dx*k-c.x)**2+(A[1]+dz*k-c.z)**2; if(d<bd){ bd=d; j0=j; } }   // 由救護車而家喺路線上嘅位置開始跟，唔會倒返轉頭
  list.forEach((k,i)=>{ const U=SUP[k]; let back=16+i*13; while(back>6&&!(cellAt(c.x-fx*back,c.z-fz*back)&1)) back-=2;
    const start=[c.x-fx*back,c.z-fz*back], stopAt=Math.max(15,R.len-13-i*10), pts=[start], cum=[0];
    for(let j=j0;j<R.pts.length;j++){ if(R.cum[j]<=stopAt) pts.push(R.pts[j].slice()); else { const A=R.pts[j-1],B=R.pts[j],q=(stopAt-R.cum[j-1])/((R.cum[j]-R.cum[j-1])||1); pts.push([A[0]+(B[0]-A[0])*q,A[1]+(B[1]-A[1])*q]); break; } }
    for(let j=1;j<pts.length;j++) cum.push(cum[j-1]+Math.hypot(pts[j][0]-pts[j-1][0],pts[j][1]-pts[j-1][1]));
    const m=U.mk(); m.userData.len=U.len; m.visible=i===0; m.position.set(start[0],0,start[1]); scene.add(m);
    ESC.push({kind:k,m,pts,cum,s:0,delay:i*0.8,v:Math.max(0,S.car.v),pose:null,done:false,vmax:U.sp,arrive:U.arr,follow:!U.fast,idx:i}); });   // 警車跟救護車同速；消防車、救護電單車快過救護車，會爬頭先到
  toast(list.map(k=>SUP[k].nm).join('、')+' 同你一齊出發！'); }
function queueSupport(list,armed){ S.supQ=list&&list.length?{list,armed:!!armed,t:1}:null; }   // 救護車離開救護站大約 1 秒後，支援單位喺後面出現
function escortTick(dt,t){ const on=Math.floor(t*5)%2===0;
  if(S.supQ&&S.mode==='drive'){ const q=S.supQ; if(!q.armed&&Math.hypot(S.car.x-DEPOT.pos[0],S.car.z-DEPOT.pos[1])>16) q.armed=true; if(q.armed&&(q.t-=dt)<=0){ S.supQ=null; launchSupport(q.list); } }
  for(const e of ESC){ if(e.static) continue; e.m.userData.blues.forEach((b,i)=>b.material.emissive.setHex((i%2===0)===on?(b.userData.on||0x1550ff):0));
    if(e.delay>0){ e.delay-=dt; if(e.delay<=0){ e.m.visible=true; } else continue; }
    if(e.done){ (e.m.userData.wheels||[]).forEach(()=>{}); }
    const L=e.cum[e.cum.length-1]; let target=e.done?0:(e.vmax||14);
    if(e.follow&&!e.done&&S.step===1&&e.pose){ const c=S.car, dx=c.x-e.pose.x, dz=c.z-e.pose.z, ah=dx*Math.sin(e.pose.a)+dz*Math.cos(e.pose.a), gap=Math.hypot(dx,dz), want=11+e.idx*10;   // 跟救護車同樣速度，保持車距
      target=ah>0?Math.max(0,Math.min(34,Math.abs(c.v)+(gap-want)*0.9)):Math.min(target,Math.abs(c.v)*0.6); }
    if(L-e.s<12) target=Math.min(target,(L-e.s)*1.2);
    // 行車線：e.lat 係向對面線偏移幾多米（0＝自己線）。前面有慢車就睇對面線清唔清，清就過對面線超車；唔清就停，唔會穿過其他車
    const at=s=>{ let q=1; while(q<e.cum.length-1&&e.cum[q]<s) q++; const A=e.pts[q-1],B=e.pts[q],k=(s-e.cum[q-1])/((e.cum[q]-e.cum[q-1])||1); return [A[0]+(B[0]-A[0])*k,A[1]+(B[1]-A[1])*k,Math.atan2(B[0]-A[0],B[1]-A[1])]; };
    const [bx,bz,ba]=at(e.s), ux=Math.sin(ba), uz=Math.cos(ba), ox=-uz, oz=ux;   // 自己線中心、前進方向、對面線方向
    if(!e.oo||(e.ooT=(e.ooT||0)-dt)<0){ e.ooT=0.5; let best=null,bd=1e9; for(const r of MAP.roads){ const P=NODES[r.n[0]],Q=NODES[r.n[1]],dx=Q[0]-P[0],dz=Q[1]-P[1],L2=dx*dx+dz*dz||1; let k=((bx-P[0])*dx+(bz-P[1])*dz)/L2; k=Math.max(0,Math.min(1,k)); const d=(P[0]+dx*k-bx)**2+(P[1]+dz*k-bz)**2; if(d<bd){ bd=d; best=r; } } e.oo=best?Math.max(5,laneOff(best)*2-1.6):6; }
    e.lat=e.lat||0; e.latT=e.latT||0; let block=99, oppAhead=99, ownBack=false, oppBusy=false, blockEsc=false;
    if(!e.done) for(const o of [...cars,...trams,{pose:{x:S.car.x,z:S.car.z},me:1},...ESC]){ if(o===e||!o.pose||(o.m&&!o.m.visible&&!o.me)) continue; const qx=o.pose.x-bx, qz=o.pose.z-bz, ah=qx*ux+qz*uz, lo=qx*ox+qz*oz; if(ah<-12||ah>45) continue;
      const half=((o.m&&o.m.userData.len)||4.4)/2+((e.m.userData.len||6)/2);
      if(Math.abs(lo-e.lat)<2.4&&ah>0&&ah-half<block){ block=ah-half; blockEsc=!!(o.follow||o.me); }                       // 前面同一條線
      if(Math.abs(lo)<2.4&&ah>-half-3&&ah<half+6) ownBack=true;                               // 自己線（返嚟用）有車
      if(Math.abs(lo-e.oo)<2.8){ if(ah>-half-4&&ah<half+30) oppBusy=true; if(ah>0) oppAhead=Math.min(oppAhead,ah-half); } }
    const left=L-e.s;
    if(e.latT===0&&block<30&&left>34&&!oppBusy&&!(e.follow&&blockEsc)) e.latT=e.oo;   // 車隊唔會超前面嘅救護車／支援車                                     // 出去對面線超車
    else if(e.latT>0&&(!ownBack||left<20)&&block>6) e.latT=0;                                     // 超咗車：返自己線
    else if(e.latT>0&&oppAhead<16&&!ownBack) e.latT=0;                                            // 對面有車嚟：避返入去
    if(block<16) target=Math.min(target,Math.max(0,(block-3)*1.2)); if(block<4) e.v=0;            // 太近就即刻停，唔會撞埋去
    if(e.latT>0&&oppAhead<10) { target=0; if(oppAhead<4) e.v=0; }
    e.v+=(target-e.v)*Math.min(1,dt*2); e.s=Math.min(L,e.s+e.v*dt); if(L-e.s<0.3&&!e.done){ e.done=true; if(e.arrive) toast(e.arrive); }
    const dl=e.latT-e.lat, step=Math.min(Math.abs(dl),dt*Math.max(3,e.v*0.5)); e.lat+=Math.sign(dl)*step;
    const [x0,z0,a]=at(e.s), x=x0+(-Math.cos(a))*e.lat, z=z0+Math.sin(a)*e.lat, steer=Math.atan2(Math.sign(dl)*step/Math.max(dt,1e-3),Math.max(2,e.v))*0.6;
    const want=a-steer, prevA=e.pose?e.pose.a:want; const na=prevA+(((want-prevA)%(Math.PI*2)+Math.PI*3)%(Math.PI*2)-Math.PI)*Math.min(1,dt*5);
    e.pose={x,z,a:na}; groundPose(e.m,x,0.12,z,na,e.m.userData.len||6); (e.m.userData.wheels||[]).forEach(w=>w.rotation.x+=e.v*dt/0.6); } }

/* ---------- 提示字體大小（小／中／大）：放大字幕、提示、派單、無線電、教學、任務卡同答題 ---------- */
{ const st=document.createElement('style'); st.textContent='#cap,#toast,#callBox,#radio,#coach,#hudWrap .top .card,#rMis,#rDisp,#quiz .panel,#stabBox{zoom:var(--fz,1)}'; document.head.append(st); }
function applyFontSz(){ const v=store.get('fontSz',0); document.documentElement.style.setProperty('--fz',[1,1.2,1.4][v]||1); }
applyFontSz();
/* ---------- 免責聲明（PIN 畫面嗰份，喺設定都睇得返） ---------- */
function showLegal(){ let d=document.getElementById('legalBox'); if(!d){ d=document.createElement('div'); d.id='legalBox';
    d.style.cssText='position:fixed;inset:0;z-index:100;background:#0b0f16e8;display:flex;align-items:center;justify-content:center;padding:16px';
    d.innerHTML='<div style="width:min(520px,94vw);max-height:88vh;overflow:auto;background:#16212c;color:#c9d3de;border:1px solid #2c3a49;border-radius:14px;padding:14px 16px;font-size:13px;line-height:1.6;text-align:left"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><b style="font-size:16px;color:#fff">免責聲明 Disclaimer</b><span style="margin-left:auto;display:flex;gap:4px"><button data-l="zh" class="lgt">中文</button><button data-l="en" class="lgt">English</button><button id="lgX" aria-label="關閉">✕</button></span></div><div id="lgZh">'+(window.LEGAL_ZH||'')+'</div><div id="lgEn" style="display:none">'+(window.LEGAL_EN||'')+'</div></div><style>#legalBox p{margin:0 0 10px}#legalBox a{color:#8fc3ff}#legalBox button{font:inherit;font-size:12px;padding:4px 10px;border-radius:8px;border:1px solid #3a4756;background:transparent;color:#fff}#legalBox .lgt.on{background:#e23b3b}</style>';
    document.body.append(d);
    const pick=l=>{ d.querySelector('#lgZh').style.display=l==='zh'?'':'none'; d.querySelector('#lgEn').style.display=l==='en'?'':'none'; d.querySelectorAll('.lgt').forEach(b=>b.classList.toggle('on',b.dataset.l===l)); };
    d.querySelectorAll('.lgt').forEach(b=>b.onclick=()=>pick(b.dataset.l)); pick('zh');
    d.querySelector('#lgX').onclick=()=>d.style.display='none'; d.addEventListener('click',e=>{ if(e.target===d) d.style.display='none'; }); }
  d.style.display='flex'; }
/* ---------- 隱藏解鎖：撳左上角 A188 五下 ---------- */
let badgeN=0, badgeT=0;
document.querySelector('#menu .badge').addEventListener('click',()=>{ const now=Date.now(); if(now-badgeT>4000) badgeN=0; badgeT=now; badgeN++;
  if(badgeN>=5){ badgeN=0; store.set('unlockAll',1); S.unlockMsg=true; renderMenu(S.tab); } });
const unlockedAll=()=>!!store.get('unlockAll',0);

/* ---------- 防撞探測：前面（倒車時後面）有人、車或者障礙物就自動煞車 ---------- */
S.aeb=store.get('aeb',true);
const aebFan=(()=>{ const g=new THREE.PlaneGeometry(2.6,1); g.rotateX(-Math.PI/2); g.translate(0,0,0.5);
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0x22e06a,transparent:true,opacity:0.22,depthWrite:false})); m.renderOrder=3; scene.add(m); m.visible=false; return m; })();
function aebSense(c,dir,look){ const fx=Math.sin(c.a)*dir, fz=Math.cos(c.a)*dir, rx=fz, rz=-fx; let best=Infinity;
  const test=(x,z,hw)=>{ const qx=x-c.x, qz=z-c.z, ah=qx*fx+qz*fz, lat=Math.abs(qx*rx+qz*rz); if(ah>VSPEC.nose-0.4&&ah<look+VSPEC.nose&&lat<1.3*VSPEC.kw+hw) best=Math.min(best,ah-VSPEC.nose); };
  peds.forEach(p=>{ if(p.pos) test(p.pos[0],p.pos[1],0.5); });
  [...cars,...trams,...ESC].forEach(o=>{ if(!o.pose) return; const half=(o.m.userData.len||4.4)/2, sa=Math.sin(o.pose.a), ca=Math.cos(o.pose.a);
    for(let q=-half;q<=half;q+=1.5) test(o.pose.x+sa*q,o.pose.z+ca*q,1.2); });
  for(let d=VSPEC.nose+0.2;d<look+VSPEC.nose;d+=1) for(const l0 of [-1.1,0,1.1]){ const l=l0*VSPEC.kw; if(cellAt(c.x+fx*d+rx*l,c.z+fz*d+rz*l)&6){ best=Math.min(best,d-VSPEC.nose); break; } }
  return best; }
function aebTick(dt){ const c=S.car; aebFan.visible=false; if(!S.aeb||S.mode!=='drive'||!S.leftDepot) return;
  const dir=c.v<-0.3||(S.hold.B&&c.v<=0.5)?-1:1, v=Math.abs(c.v), look=Math.max(6,v*v/(2*30)+6);
  const d=aebSense(c,dir,look); const hit=d<look;
  aebFan.visible=true; { const ax=c.x+Math.sin(c.a)*VSPEC.nose*dir, az=c.z+Math.cos(c.a)*VSPEC.nose*dir; aebFan.position.set(ax,0.32+ELEV(ax,az),az); } aebFan.rotation.y=c.a+(dir<0?Math.PI:0); aebFan.scale.set(1,1,Math.min(look,hit?Math.max(0.5,d):look));
  aebFan.material.color.setHex(hit?0xff3b30:0x22e06a);
  if(hit&&((dir>0&&c.v>0)||(dir<0&&c.v<0)||v<0.3)){ // 自動煞車；太近就唔准再向前
    if(dir>0){ c.v=Math.max(0,c.v-(d<3?80:48)*dt); if(d<2.5&&S.hold.G) c.v=0; } else { c.v=Math.min(0,c.v+(d<3?80:48)*dt); if(d<2.5&&S.hold.B) c.v=0; }
    if(v>2&&(!S.aebT||performance.now()-S.aebT>2500)){ S.aebT=performance.now(); toast('⚠️ 偵測到障礙，自動煞車'); } } }
function aebShow(){ $('bAEB').textContent='防撞 '+(S.aeb?'開':'關'); $('bAEB').setAttribute('aria-pressed',S.aeb); }
$('bAEB').onclick=()=>{ S.aeb=!S.aeb; if(S.gm==='ems') store.set('aeb',S.aeb); $('bAEB').textContent='防撞 '+(S.aeb?'開':'關'); $('bAEB').setAttribute('aria-pressed',S.aeb); };
$('bAEB').textContent='防撞 '+(S.aeb?'開':'關'); $('bAEB').setAttribute('aria-pressed',S.aeb);

/* ================= 模式 ①：的士接客（Crazy Taxi 玩法） =================
   60 秒起步，路邊有 3 位乘客等車：橙＝近、黃＝中、綠＝遠。
   停喺乘客旁邊就上車，送到目的地收錢＋加時，提早送到有貼士。冇罰則，撞到只會減速。 */
const TX={ cls:{ o:{name:'橙',dist:'近程',col:0xff8c1a,css:'#ff8c1a',pay:10,add:5,r:[90,260]},
               y:{name:'黃',dist:'中程',col:0xffd21a,css:'#e6b800',pay:25,add:8,r:[260,520]},
               g:{name:'綠',dist:'遠程',col:0x2ecc40,css:'#22a83a',pay:50,add:12,r:[520,1400]} },
  wait:[], rider:null, money:0, done:0, tLeft:60, prevLiv:null, spots:null, lastNear:-1, streak:0, nm:0, nmMoney:0 };
// 乘客對白
const TXSAY={ up:['唔該，趕時間呀！','司機，快啲呀！','去呢度，唔該晒！','我遲到喇，快快快！'],
  slow:['快啲呀司機！','咁慢嘅？','我趕時間㗎！','你揸緊龜呀？'], wow:['嘩！好刺激！','好嘢！夠快！','司機你好勁！','好險呀！'],
  thanks:['多謝司機！','好快！唔使找！','正！下次再搭！'], angry:['唔坐喇！','咁慢我自己行好過！'] };
const txPick=a=>a[Math.random()*a.length|0];
function txSay(txt){ document.querySelectorAll('.txsay').forEach(e=>e.remove()); const d=document.createElement('div'); d.className='txsay'; d.textContent=txt; document.body.appendChild(d); setTimeout(()=>d.remove(),2300); }
const txMult=()=>TX.streak>=4?3:TX.streak>=2?2:1;
function txCombo(){ const e=$('txCombo'), m=txMult(); if(m>1&&S.gm==='taxi'){ e.style.display='block'; e.textContent='🔥 連送 ×'+m; } else e.style.display='none'; }
// 路邊上落客位：所有街道（唔包高架元朗公路、橋）每段中間兩邊
function taxiSpots(){ if(TX.spots) return TX.spots; const out=[];
  MAP.roads.forEach(r=>{ if(r.bridge||r.elev) return; const A=NODES[r.n[0]],B=NODES[r.n[1]]; const L=Math.hypot(B[0]-A[0],B[1]-A[1]); if(L<30) return;
    const ux=(B[0]-A[0])/L, uz=(B[1]-A[1])/L; for(const sd of [-1,1]){ const o=r.w/2+1.6; const x=(A[0]+B[0])/2+uz*o*sd, z=(A[1]+B[1])/2-ux*o*sd;
      const rx=(A[0]+B[0])/2+uz*(r.w/4)*sd, rz=(A[1]+B[1])/2-ux*(r.w/4)*sd; out.push({p:[x,z],road:[rx,rz],face:Math.atan2(-uz*sd,ux*sd)}); } });
  if(NEON) NEON.rail.cutPts(out.map(s=>s.p),3.6);   // 乘客上落位唔好有欄杆
  return TX.spots=out; }
function txBeep(f,d){ try{ ensureAudio(); if(!actx) return; const o=actx.createOscillator(), g=actx.createGain(); o.type='sine'; o.frequency.value=f; g.gain.value=0.05; g.gain.exponentialRampToValueAtTime(0.0001,actx.currentTime+d+0.12); o.connect(g); g.connect(master); o.start(); o.stop(actx.currentTime+d+0.14); }catch(e){} }
const txD=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function txMarker(col){ const g=new THREE.Group(); scene.add(g);
  const pm=person('bystander'); pm.scale.setScalar(0.9); g.add(pm);
  const ringM=new THREE.Mesh(new THREE.TorusGeometry(2.6,0.28,8,32),new THREE.MeshBasicMaterial({color:col})); ringM.rotation.x=Math.PI/2; ringM.position.y=0.3; g.add(ringM);
  const col3=new THREE.Mesh(new THREE.CylinderGeometry(0.9,0.9,26,12,1,true),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.35,depthWrite:false,side:THREE.DoubleSide})); col3.position.y=13; g.add(col3);
  const dia=new THREE.Mesh(new THREE.OctahedronGeometry(0.9),new THREE.MeshBasicMaterial({color:col})); dia.position.y=4.6; g.add(dia); g.userData={dia,pm}; return g; }
function txDrop(m){ scene.remove(m); m.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); }
// 補足 3 位等車乘客（每種顏色一位），喺車附近 60–260 米
function txFill(){ const c=S.car, spots=taxiSpots();
  while(TX.wait.length<2){ const have=new Set(TX.wait.map(w=>w.k)); const free=['o','y','g'].filter(k=>!have.has(k)); const k=free[Math.random()*free.length|0];
    let cand=spots.filter(s=>{ const d=txD(s.p,[c.x,c.z]); return d>25&&d<130&&!TX.wait.some(w=>txD(w.s.p,s.p)<30); });
    if(!cand.length) cand=spots.filter(s=>{ const d=txD(s.p,[c.x,c.z]); return d>25&&d<260; });
    if(!cand.length) cand=spots.filter(s=>txD(s.p,[c.x,c.z])<420);
    const s=cand[Math.random()*cand.length|0]; if(!s) break; const m=txMarker(TX.cls[k].col); m.position.set(s.p[0],ELEV(s.p[0],s.p[1]),s.p[1]); m.userData.pm.rotation.y=s.face;
    TX.wait.push({k,s,m}); } }
function txPickDest(k,from){ const R=TX.cls[k].r, spots=taxiSpots();
  let cand=spots.filter(s=>{ const d=txD(s.p,from); return d>=R[0]&&d<=R[1]; });
  if(!cand.length) cand=spots.filter(s=>txD(s.p,from)>R[0]*0.6);
  return cand[Math.random()*cand.length|0]||spots[0]; }
function txSetNav(){ const c=S.car; let tg;
  if(TX.rider) tg=TX.rider.dest.road;
  else { let best=null,bd=1e9; TX.wait.forEach(w=>{ const d=txD(w.s.road,[c.x,c.z]); if(d<bd){ bd=d; best=w; } }); if(!best) return; tg=best.s.road; TX.lastNear=best; }
  setTarget(tg); refreshRoute(true); const col=TX.rider?TX.cls[TX.rider.k].col:TX.lastNear?TX.cls[TX.lastNear.k].col:0xff7a1a;
  ring.material.color.setHex(col); ring.material.emissive&&ring.material.emissive.setHex(0x222222); beacon.material.color.setHex(col); }
function txHud(){ const r=TX.rider; hud('💰 $'+TX.money,' · '+(r?'送'+TX.cls[r.k].name+'色乘客（'+TX.cls[r.k].dist+'）':'接客：揀一位乘客')+' · 已送 '+TX.done+' 位'); }
function startTaxi(){ ensureAudio(); if(S.gm==='chase'||S.gm==='free') chModeExit(); sirenSet(false); stopFireworks&&stopFireworks();
  if(S.gm!=='taxi') TX.prevLiv=store.get('livery','yellow'); S.gm='taxi'; applyLivery('taxi'); store.set('livery',TX.prevLiv);
  TX.wait.forEach(w=>txDrop(w.m)); TX.wait=[]; TX.rider=null; TX.money=0; TX.done=0; TX.tLeft=60; TX.lastNear=null; TX.flash=0; TX.streak=0; TX.nm=0; TX.nmMoney=0; TX.lastDrop=performance.now()/1000; txCombo(); $('txPat').style.display='none';
  S.level={id:'TAXI',limit:9,tod:'day'}; S.kase={id:'taxi',title:'的士接客',tips:[],steps:[],loc:null};
  resetActors(); setTOD('day'); clearEvents();
  // 隨機喺屯門市區一條街開始
  const st=taxiSpots().filter(s=>s.p[0]<240&&s.p[1]>-440); const s0=st[Math.random()*st.length|0];
  Object.assign(S.car,{x:s0.road[0],z:s0.road[1],a:s0.face+Math.PI/2,v:0}); S.camYaw=S.car.a;
  Object.assign(S,{mode:'drive',step:'taxi',leftDepot:true,lives:5,collided:false,redRun:false,inX:-1,quizOpen:false,lastHit:-9,t0:performance.now()/1000});
  S.spawnFree=true; for(let n=0;n<22;n++){ const c={m:carModel(['taxi','car','bus','car','minibus','taxi','car'][n%7])}; if(placeCar(c,S.car.x,S.car.z)) cars.push(c); else dropModel(c.m); }
  for(let n=0;n<PED_N;n++){ const p={m:pedModel()}; if(placePed(p,S.car.x,S.car.z)) peds.push(p); else scene.remove(p.m); } S.spawnFree=false;
  S.aeb=false; aebShow(); $('lives').style.display='none'; $('txBig').style.display='block'; $('txBig').textContent='60'; document.body.classList.add('taxi'); show('menu',false); show('result',false); show('over',false); show('hudWrap',true); show('stabBox',false);
  txFill(); txSetNav(); txHud(); caption('🚕 60 秒內接最多客！停喺有顏色光柱嘅乘客旁邊就上車'); setTimeout(()=>{ if(S.gm==='taxi'&&S.mode==='drive') caption(null); },3500);
  $('hTime').textContent=fmt(TX.tLeft); }
function txFloat(txt,css){ const d=document.createElement('div'); d.className='txpop'; d.textContent=txt; d.style.color=css; document.body.appendChild(d); setTimeout(()=>d.remove(),1600); }
function taxiTick(dt,d){ const c=S.car;
  TX.tLeft-=dt; const el=$('hTime'); el.textContent=fmt(Math.max(0,TX.tLeft)); el.classList.toggle('warn',TX.tLeft<10);
  const bc=$('txBig'), sec=Math.max(0,Math.ceil(TX.tLeft)); if(bc.textContent!==String(sec)){ bc.textContent=sec; bc.classList.toggle('warn',TX.tLeft<10); if(TX.tLeft<10){ bc.classList.remove('tick'); void bc.offsetWidth; bc.classList.add('tick'); } }
  const now=performance.now()/1000; TX.wait.forEach((w,i)=>{ w.m.userData.dia.rotation.y=now*2; w.m.userData.dia.position.y=4.6+Math.sin(now*3+i)*0.3; });
  pedFlyTick(dt);
  // 擦身而過：高速好近咁擦過其他車
  if(Math.abs(c.v)>16&&now-(S.lastHit||-9)>1.2){ for(const k of cars){ if(!k.pose) continue; const dx=k.pose.x-c.x, dz=k.pose.z-c.z, d2=dx*dx+dz*dz; if(d2>64) continue;
      const half=(k.m.userData.len||4)/2, kx=Math.sin(k.pose.a), kz=Math.cos(k.pose.a); const pr=Math.max(-half,Math.min(half,(c.x-k.pose.x)*kx+(c.z-k.pose.z)*kz)); const dd=Math.hypot(k.pose.x+kx*pr-c.x,k.pose.z+kz*pr-c.z);
      if(dd>3.3&&dd<5.2&&now-(k.nmT||0)>3){ k.nmT=now; TX.money+=2; TX.nm++; TX.nmMoney+=2; txFloat('好險！ +$2','#1f8fff'); txBeep(1560,0.05); if(TX.rider&&Math.random()<0.35) txSay(txPick(TXSAY.wow)); txHud(); } } }
  if(TX.tLeft<=0){ taxiEnd(); return; }
  if(!TX.rider){ // 上車：慢速經過任何一位乘客旁邊
    for(let i=0;i<TX.wait.length;i++){ const w=TX.wait[i]; if(txD(w.s.p,[c.x,c.z])<9&&Math.abs(c.v)<6){
      TX.wait.splice(i,1); txDrop(w.m); const dest=txPickDest(w.k,w.s.p); TX.rider={k:w.k,dest,t0:now};
      txSetNav(); const exp=(S.route?S.route.len:txD(dest.p,w.s.p))/17+6; TX.rider.exp=exp; txHud();
      TX.rider.pat=exp*1.8+6; TX.rider.slowSaid=0; $('txPat').style.display='block'; txSay(txPick(TXSAY.up)); txBeep(880,0.08); break; } }
    if(TX.streak>0&&now-TX.lastDrop>15){ TX.streak=0; txCombo(); toast('連送中斷'); }
    // 每秒睇吓邊位最近
    TX.navT=(TX.navT||0)+dt; if(TX.navT>1){ TX.navT=0; let best=null,bd=1e9; TX.wait.forEach(w=>{ const dd=txD(w.s.road,[c.x,c.z]); if(dd<bd){ bd=dd; best=w; } }); if(best&&best!==TX.lastNear) txSetNav();
      if(TX.wait.some(w=>txD(w.s.p,[c.x,c.z])>320)){ TX.wait.filter(w=>txD(w.s.p,[c.x,c.z])>320).forEach(w=>txDrop(w.m)); TX.wait=TX.wait.filter(w=>txD(w.s.p,[c.x,c.z])<=320); txFill(); txSetNav(); } }
  } else { const R=TX.rider, used=now-R.t0, left=1-used/R.pat; $('txPat').firstChild.style.width=Math.max(0,left*100)+'%'; $('txPat').firstChild.style.background=left>0.5?'#2ecc40':left>0.25?'#ffb020':'#e8323c';
    if(Math.abs(c.v)<4&&used>4&&now-R.slowSaid>6){ R.slowSaid=now; txSay(txPick(TXSAY.slow)); }
    if(left<=0){ txSay(txPick(TXSAY.angry)); toast('乘客嬲到落車走咗！'); TX.rider=null; TX.streak=0; txCombo(); $('txPat').style.display='none'; txBeep(220,0.2); TX.lastDrop=now; txFill(); txSetNav(); txHud(); return; }
  }
  if(TX.rider&&txD(TX.rider.dest.p,[c.x,c.z])<10&&Math.abs(c.v)<6){ // 落車收錢
    const K=TX.cls[TX.rider.k], used=now-TX.rider.t0, fast=used<TX.rider.exp, tip=fast?Math.round(Math.min(15,(TX.rider.exp-used)*0.8)):0;
    TX.streak=fast?TX.streak+1:0; const mult=txMult(); TX.lastDrop=now; txCombo(); $('txPat').style.display='none';
    TX.money+=(K.pay+tip)*mult; TX.tLeft+=K.add; { const bc=$('txBig'); bc.classList.remove('plus'); void bc.offsetWidth; bc.classList.add('plus'); } TX.done++; TX.rider=null; txSay(txPick(TXSAY.thanks));
    txFloat('+$'+(K.pay+tip)*mult+(mult>1?' (×'+mult+')':'')+'   +'+K.add+' 秒',K.css); txBeep(1320,0.1);
    txFill(); txSetNav(); txHud(); }
}
function txFireN(m){ return m>=300?5:m>=200?4:m>=120?3:m>=60?2:m>0?1:0; }
function taxiEnd(){ $('txCombo').style.display='none'; $('txPat').style.display='none'; $('txBig').style.display='none'; document.body.classList.remove('taxi'); S.mode='result'; caption(null); $('rTitle').textContent='⏰ 收工！'; TX.wait.forEach(w=>txDrop(w.m)); TX.wait=[]; ring.visible=beacon.visible=arrow.visible=false;
  const best=store.get('taxiBest',0), nb=TX.money>best; if(nb) store.set('taxiBest',TX.money);
  $('rStars').textContent='💰 $'+TX.money; $('rTime').textContent='送咗 '+TX.done+' 位乘客 · 擦身而過 '+TX.nm+' 次（$'+TX.nmMoney+'）';
  $('rNote').innerHTML=nb&&TX.money>0?'🎉 新紀錄！':'最高紀錄：$'+Math.max(best,TX.money);
  $('rAch').innerHTML=''; $('rTips').innerHTML='<small>橙＝近程 $10 +5 秒 · 黃＝中程 $25 +8 秒 · 綠＝遠程 $50 +12 秒 · 提早送到有貼士</small>'; $('rNext').style.display='none';
  S.stars=TX.money; S.tHosp=0; $('rName').value=getName(); $('rSave').disabled=false; $('rSave').textContent='儲存到排行榜';
  show('result',true); show('hudWrap',false); fireworks(txFireN(TX.money)); }
function taxiExit(){ S.aeb=store.get('aeb',true); aebShow(); $('txCombo').style.display='none'; $('txPat').style.display='none'; $('txBig').style.display='none'; document.body.classList.remove('taxi'); TX.wait.forEach(w=>txDrop(w.m)); TX.wait=[]; TX.rider=null; if(S.gm==='taxi'){ S.gm='ems'; applyLivery(TX.prevLiv||'yellow'); } $('lives').style.display='';
  ring.material.color.setHex(0xff7a1a); beacon.material.color.setHex(0xff7a1a); }
/* ---------- 撞到行人：卡通彈開、轉幾轉、再起身（新模式用） ---------- */
function pedFly(p,c){ if(p.mode==='fly') return; const sp=Math.max(6,Math.abs(c.v)); const a=Math.atan2(p.pos[0]-c.x,p.pos[1]-c.z);
  p.fly={vx:Math.sin(a)*sp*0.55+Math.sin(c.a)*sp*0.3,vz:Math.cos(a)*sp*0.55+Math.cos(c.a)*sp*0.3,vy:7+sp*0.25,y:0,spin:(Math.random()<0.5?-1:1)*(8+sp*0.3),t:0,base:ELEV(p.pos[0],p.pos[1])};
  p.prevMode=p.mode; p.mode='fly'; c.v*=0.85; txBeep(520,0.06); }
function pedFlyTick(dt){ for(const p of peds){ if(p.mode!=='fly') continue; const f=p.fly; f.t+=dt;
    if(f.y>0||f.vy>0){ f.vy-=22*dt; f.y=Math.max(0,f.y+f.vy*dt); p.pos=[p.pos[0]+f.vx*dt,p.pos[1]+f.vz*dt]; p.m.rotation.x+=f.spin*dt; if(f.y===0&&f.vy<0){ f.vy=f.vy<-6?-f.vy*0.35:0; f.vx*=0.5; f.vz*=0.5; } }
    else { f.vx*=0.8; f.vz*=0.8; p.m.rotation.x=-Math.PI/2*Math.min(1,(1.6-f.t)>0?1:0); if(p.funPool&&f.t>0.5){ p.funPool=false; bloodPool(p.pos[0],p.pos[1],f.base); } }   // 歡樂模式：倒地後血泊慢慢擴大
    if(f.t>1.6){ if(FUN.on||!DODGE.on){ p.m.rotation.set(-Math.PI/2,p.m.rotation.y,0); p.mode='down'; p.fly=null; if(!FUN.on) p.downT=2; } else { p.m.rotation.x=0; p.m.rotation.z=0; p.mode='idle'; p.fly=null; } }
    p.m.position.set(p.pos[0],f.base+(f.y||0),p.pos[1]); } }
window.__TX=TX;

/* ================= 模式 ②：追逐模式（逃避警車） =================
   用「車款」揀咗嘅車，喺隨機地點開始。警車開住警號追你，時間越耐警車同路障越多。
   撞到警車或者路障扣一粒生命之星，扣晒就被捕；撐夠 60 秒就成功逃脫。撞到人唔扣分（卡通彈開）。 */
const CH={ cops:[], blocks:[], tLeft:60, t:0, hitT:-9, sir:null, nextBlock:6 };
function chModeExit(){ if(typeof taxiExit==='function'&&S.gm==='taxi') taxiExit(); if(S.gm==='chase') chaseExit(); if(S.gm==='free') freeExit(); if(S.gm==='cpr') cprExit(); }
function chSpot(minD,maxD,ahead){ const c=S.car, fx=Math.sin(c.a), fz=Math.cos(c.a);
  let cand=taxiSpots().filter(s=>{ const dx=s.road[0]-c.x, dz=s.road[1]-c.z, d=Math.hypot(dx,dz); if(d<minD||d>maxD) return false;
    if(ahead!=null&&(dx*fx+dz*fz)/d*ahead<0.2) return false; return !inView(s.road[0],s.road[1],6); });
  if(!cand.length) cand=taxiSpots().filter(s=>{ const d=Math.hypot(s.road[0]-c.x,s.road[1]-c.z); return d>minD&&d<maxD*1.6&&!inView(s.road[0],s.road[1],6); });
  return cand[Math.random()*cand.length|0]; }
function chAddCop(){ const s=chSpot(90,170,-1); if(!s) return; const m=SKB.police(); scene.add(m); m.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
  const cop={m,x:s.road[0],z:s.road[1],a:Math.atan2(S.car.x-s.road[0],S.car.z-s.road[1]),v:0,path:null,pT:Math.random(),stuck:0,back:0}; CH.cops.push(cop); }
function chDrop(m){ scene.remove(m); m.traverse(o=>{ if(o.geometry&&!o.geometry.userData.shared) o.geometry.dispose(); }); }
// 路障：攔住大約七成路面，留一條窄位
function chAddBlock(){ const s=chSpot(70,180,1); if(!s) return; const r=MAP.roads.reduce((b,q)=>{ const A=NODES[q.n[0]],B=NODES[q.n[1]]; const d=Math.abs((B[0]-A[0])*(A[1]-s.road[1])-(A[0]-s.road[0])*(B[1]-A[1]))/(Math.hypot(B[0]-A[0],B[1]-A[1])||1); return !b||d<b.d?{q,d}:b; },null).q;
  const A=NODES[r.n[0]],B=NODES[r.n[1]]; const [ux,uz]=dirn(A,B); const nx=uz, nz=-ux; const mx=(A[0]+B[0])/2, mz=(A[1]+B[1])/2, half=r.w/2, gapSide=Math.random()<0.5?-1:1;
  const g=new THREE.Group(); g.position.set(mx,ELEV(mx,mz),mz); g.rotation.y=Math.atan2(ux,uz); scene.add(g); const circ=[];
  const bar=vtex('chbar',128,32,(c,W,H)=>{ for(let i=0;i<8;i++){ c.fillStyle=i%2?'#ffffff':'#e8202a'; c.beginPath(); c.moveTo(i*20-10,H); c.lineTo(i*20+6,0); c.lineTo(i*20+22,0); c.lineTo(i*20+6,H); c.fill(); } });
  for(let o=-half+1.2;o<=half-1.2;o+=2.4){ if(o*gapSide>half*0.4) continue; const b=new THREE.Group(); b.position.set(o,0,0); g.add(b);
    add(new THREE.BoxGeometry(2.2,0.5,0.25),bar,b,0,1.0,0,true); [-0.9,0.9].forEach(x=>add(new THREE.BoxGeometry(0.12,1.1,0.12),M(0x9aa1ab),b,x,0.55,0,false));
    circ.push([mx+nx*o,mz+nz*o]); }
  for(const sd of [-1,1]){ const cone=add(new THREE.ConeGeometry(0.35,0.9,10),M(0xff7a1a),g,(gapSide*-half*0.2)+sd*3,0.45,-2.4,false); }
  const pc=SKB.police(); pc.position.set(-gapSide*(half*0.45),0,3.2); pc.rotation.y=Math.PI/2*0.85; g.add(pc);
  const ox=-gapSide*(half*0.45); circ.push([mx+nx*ox+ux*3.2,mz+nz*ox+uz*3.2],[mx+nx*(ox+2)+ux*3.2,mz+nz*(ox+2)+uz*3.2],[mx+nx*(ox-2)+ux*3.2,mz+nz*(ox-2)+uz*3.2]);
  CH.blocks.push({g,circ,x:mx,z:mz,pc}); }
function chSiren(on){ try{ if(on&&!CH.sir){ ensureAudio(); if(!actx) return; const o=actx.createOscillator(), g=actx.createGain(); o.type='square'; o.frequency.value=900; g.gain.value=0; const f=actx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=1800; o.connect(f); f.connect(g); g.connect(master); o.start(); CH.sir={o,g}; }
  if(!on&&CH.sir){ CH.sir.o.stop(); CH.sir=null; } }catch(e){} }
function startChase(){ ensureAudio(); chModeExit(); sirenSet(false); stopFireworks&&stopFireworks();
  S.gm='chase'; CH.cops.forEach(p=>chDrop(p.m)); CH.blocks.forEach(b=>chDrop(b.g)); CH.cops=[]; CH.blocks=[]; CH.tLeft=60; CH.t=0; CH.hitT=-9; CH.nextBlock=6;
  S.level={id:'CHASE',limit:9,tod:'day'}; S.kase={id:'chase',title:'追逐模式',tips:[],steps:[],loc:null};
  resetActors(); setTOD(Math.random()<0.5?'day':'dusk'); clearEvents();
  const sp=taxiSpots(); const s0=sp[Math.random()*sp.length|0]; Object.assign(S.car,{x:s0.road[0],z:s0.road[1],a:s0.face+Math.PI/2,v:0}); S.camYaw=S.car.a;
  Object.assign(S,{mode:'drive',step:'chase',leftDepot:true,lives:5,collided:false,redRun:false,inX:-1,quizOpen:false,lastHit:-9,t0:performance.now()/1000,route:null,target:[S.car.x,S.car.z]});
  ring.visible=beacon.visible=arrow.visible=false; if(routeMesh) routeMesh.visible=false;
  S.spawnFree=true; for(let n=0;n<20;n++){ const c={m:carModel(['taxi','car','bus','car','minibus','taxi','car'][n%7])}; if(placeCar(c,S.car.x,S.car.z)) cars.push(c); else dropModel(c.m); }
  for(let n=0;n<PED_N;n++){ const p={m:pedModel()}; if(placePed(p,S.car.x,S.car.z)) peds.push(p); else scene.remove(p.m); } S.spawnFree=false;
  chAddCop(); chAddCop();
  S.aeb=false; aebShow(); $('lives').style.display=''; drawLives(); show('menu',false); show('result',false); show('over',false); show('hudWrap',true); show('stabBox',false);
  $('txBig').style.display='block'; $('txBig').textContent='60'; document.body.classList.add('taxi');
  hud('🚓 追逐模式','警車 2 架 · 撐 60 秒'); caption('🚓 警車嚟緊！撐夠 60 秒就贏，撞到警車或者路障扣一粒心'); setTimeout(()=>{ if(S.gm==='chase'&&S.mode==='drive') caption(null); },3500);
  chSiren(true); }
function chHit(msg){ const now=performance.now()/1000; if(now-CH.hitT<1.5||S.mode!=='drive') return false; CH.hitT=now; S.lives--; drawLives(S.lives); toast(msg+'  −1 生命之星'); S.shake=0.6; vib(120);
  const lv=$('lives'); lv.classList.remove('hit'); void lv.offsetWidth; lv.classList.add('hit'); if(S.lives<=0) chaseEnd(false); return true; }
function chaseTick(dt){ const c=S.car, now=performance.now()/1000; CH.t+=dt; CH.tLeft-=dt; pedFlyTick(dt);
  const bc=$('txBig'), sec=Math.max(0,Math.ceil(CH.tLeft)); if(bc.textContent!==String(sec)){ bc.textContent=sec; bc.classList.toggle('warn',CH.tLeft<10); if(CH.tLeft<10){ bc.classList.remove('tick'); void bc.offsetWidth; bc.classList.add('tick'); } }
  $('hTime').textContent=fmt(Math.max(0,CH.tLeft));
  if(CH.tLeft<=0){ chaseEnd(true); return; }
  // 難度遞增：每 12 秒多一架警車（最多 6 架），定時加路障
  const want=Math.min(6,2+Math.floor(CH.t/12)); if(CH.cops.length<want&&Math.random()<dt*2){ chAddCop(); toast('🚨 多一架警車加入追捕！'); }
  if(CH.t>=CH.nextBlock){ CH.nextBlock+=Math.max(6,10-CH.t/15); chAddBlock(); }
  CH.blocks=CH.blocks.filter(b=>{ const far=Math.hypot(b.x-c.x,b.z-c.z)>280&&!inView(b.x,b.z,12); if(far) chDrop(b.g); return !far; });
  const AC=ambCircles(c.x,c.z,c.a), vmaxP=Math.min(34,25+CH.t*0.14); let nearest=1e9;
  for(const p of CH.cops){ const dx=c.x-p.x, dz=c.z-p.z, dist=Math.hypot(dx,dz); nearest=Math.min(nearest,dist);
    // 揾路：每秒用路網計一次去你嗰度嘅路；近距離就直接撲埋嚟
    p.pT-=dt; if(p.pT<=0){ p.pT=0.9+Math.random()*0.4; const r=route(nearestNode(p.x,p.z),nearestNode(c.x,c.z),[]); p.path=r?r.path.map(k=>NODES[k]):null; }
    let tx=c.x+Math.sin(c.a)*c.v*0.6, tz=c.z+Math.cos(c.a)*c.v*0.6;
    if(dist>38&&p.path&&p.path.length){ while(p.path.length>1&&Math.hypot(p.path[0][0]-p.x,p.path[0][1]-p.z)<10) p.path.shift(); tx=p.path[0][0]; tz=p.path[0][1]; }
    const want=Math.atan2(tx-p.x,tz-p.z); let da=((want-p.a)%(Math.PI*2)+Math.PI*3)%(Math.PI*2)-Math.PI;
    if(p.back>0){ p.back-=dt; p.v=Math.max(-8,p.v-30*dt); p.a-=Math.sign(da||1)*1.6*dt; }
    else { const tgtV=vmaxP*(Math.abs(da)>1.2?0.45:Math.abs(da)>0.6?0.75:1); p.v+=(tgtV>p.v?18:-30)*dt; p.a+=Math.max(-2.6,Math.min(2.6,da*3))*dt*Math.min(1,Math.abs(p.v)/6+0.3); }
    const nx=p.x+Math.sin(p.a)*p.v*dt, nz=p.z+Math.cos(p.a)*p.v*dt;
    if(hitBuilding(nx,nz,p.a)){ p.v=-p.v*0.2; p.stuck+=dt; if(p.stuck>0.5){ p.back=0.9; p.stuck=0; } } else { p.x=nx; p.z=nz; p.stuck=Math.max(0,p.stuck-dt); }
    // 甩得太遠（又唔喺鏡頭入面）就喺你後面重新出現
    if(dist>320&&!inView(p.x,p.z,8)){ const s=chSpot(110,170,-1); if(s){ p.x=s.road[0]; p.z=s.road[1]; p.a=Math.atan2(c.x-p.x,c.z-p.z); p.v=10; p.path=null; } }
    // 撞到玩家
    if(dist<7){ for(const q of AC){ if(Math.hypot(q[0]-p.x,q[1]-p.z)<3.4){ if(chHit('俾警車撞到')){ p.back=1.0; p.v=-6; c.v=-c.v*0.3+Math.sign(p.v||1)*0; const L=dist||1; c.x+=dx/L*1.2; c.z+=dz/L*1.2; } break; } } }
    groundPose(p.m,p.x,0.12,p.z,p.a,6); const on=Math.floor(now*6)%2; p.m.userData.blues.forEach((b,i)=>b.material.emissive.setHex(((i%2)===on)?(b.userData.on||0x1550ff):0)); }
  // 撞到路障
  for(const b of CH.blocks){ if(Math.hypot(b.x-c.x,b.z-c.z)>20) continue; let hit=false; for(const q of AC){ for(const k of b.circ){ if(Math.hypot(q[0]-k[0],q[1]-k[1])<2.4){ hit=true; break; } } if(hit) break; }
    if(hit){ if(chHit('撞到路障')){ c.v=-c.v*0.35; } else c.v=Math.min(c.v,0); } const on=Math.floor(now*6)%2; b.pc.userData.blues.forEach((l,i)=>l.material.emissive.setHex(((i%2)===on)?(l.userData.on||0x1550ff):0)); }
  if(CH.sir){ const k=Math.max(0,1-nearest/130); CH.sir.g.gain.setTargetAtTime(0.035*k*k,actx.currentTime,0.05); CH.sir.o.frequency.setTargetAtTime(Math.floor(now*3)%2?1150:820,actx.currentTime,0.01); }
  $('hDist').textContent=nearest<1e8?Math.round(nearest)+' 米':'--'; hud('🚓 追逐模式',' · 警車 '+CH.cops.length+' 架 · 路障 '+CH.blocks.length+' 個');
}
function chaseEnd(win){ chSiren(false); S.mode='result'; caption(null); $('txBig').style.display='none'; document.body.classList.remove('taxi');
  const surv=Math.min(60,Math.round(CH.t)); S.stars=win?S.lives:0; S.tHosp=60-surv;
  const best=store.get('chaseBest',{st:0,s:0}), nb=(S.stars>best.st)||(S.stars===best.st&&surv>best.s); if(nb) store.set('chaseBest',{st:S.stars,s:surv});
  $('rTitle').textContent=win?'🏁 成功逃脫！':'🚓 被捕！'; $('rStars').innerHTML=win?[0,1,2,3,4].map(i=>'<span class="'+(i<S.lives?'on':'off')+'">'+lifeStar(34)+'</span>').join(''):'🚓';
  $('rTime').textContent=win?'撐足 60 秒，剩低 '+S.lives+' 粒生命之星':'撐咗 '+surv+' 秒'; $('rNote').innerHTML=nb?'🎉 新紀錄！':'最佳：'+(best.st?best.st+' 粒生命之星逃脫':'撐 '+best.s+' 秒');
  $('rAch').innerHTML=''; $('rTips').innerHTML='<small>警車會跟路網追你；路障留咗一條窄位可以鑽過去。開警號，路上啲車會讓路俾你。</small>'; $('rNext').style.display='none';
  $('rName').value=getName(); $('rSave').disabled=false; $('rSave').textContent='儲存到排行榜';
  show('result',true); show('hudWrap',false); if(win) fireworks(S.lives); }
function chaseExit(){ chSiren(false); CH.cops.forEach(p=>chDrop(p.m)); CH.blocks.forEach(b=>chDrop(b.g)); CH.cops=[]; CH.blocks=[]; $('txBig').style.display='none'; document.body.classList.remove('taxi');
  S.aeb=store.get('aeb',true); aebShow(); if(S.gm==='chase') S.gm='ems'; }
window.__CH=CH; window.__chBlock=chAddBlock;

/* ================= 模式 ③：自由探索（GTA 風格，冇計分） =================
   控制一個人周圍行，行近任何一部車撳「上車」：路上嘅車司機會自己落車行開；落車後架車會泊喺原位，可以再上。
   電腦：WASD／方向鍵行路，空白鍵跳，E 上落車，滑鼠拉動轉鏡頭。手機：左下角搖桿、右下角「跳」「上車」掣。 */
const FRE={ onFoot:true, p:null, vy:0, y:0, parked:[], leavers:[], joy:{x:0,y:0,on:false}, prevLiv:null, cand:null, kind:null };
// 路面車都可以揸：私家車、小巴（其他車款用返「車款」設定）
const FREE_SPEC={ car:{id:'fcar',kind:'car',name:'私家車',vmax:33,acc:1.15,steer:2.5,siren:false,lc:[0,0],tone:[0,0,500],circ:[-1.4,1.4],kl:0.75,kw:0.85,nose:2.3},
                  minibus:{id:'fminibus',kind:'minibus',name:'小巴',vmax:30,acc:1.0,steer:2.2,siren:false,lc:[0,0],tone:[0,0,500],circ:[-2.2,0,2.2],kl:1,kw:0.95,nose:3.4} };
const KIND2LIV={amb:'yellow',moto:'moto',police:'police',fire:'fire',taxi:'taxi',bus:'bus'};
function frModel(kind){ // 泊喺路邊嘅車（可以上）
  if(kind==='car'||kind==='minibus'||kind==='taxi'||kind==='bus'){ const g=carModel(kind); return g; }
  if(kind==='amb'){ const g=ambulance('A'+(100+Math.random()*90|0)); scene.add(g); const U=g.userData; if(U.pB){ U.pB.intensity=U.pR.intensity=0; U.pB.visible=U.pR.visible=false; } g.userData.len=6; return g; }
  const g=SKB[kind](); scene.add(g); g.userData.len=kind==='moto'?2.4:kind==='fire'?6.5:5.5; return g; }
function frPlayer(){ const g=pedModel(); g.scale.setScalar(1); const cap=new THREE.Mesh(new THREE.SphereGeometry(0.66,16,8,0,Math.PI*2,0,Math.PI/2),M(0x1f4fbf)); cap.position.set(0,2.2,-0.02); cap.scale.set(1,0.75,1); g.add(cap);
  const brim=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.4,0.05,14,1,false,-Math.PI/2,Math.PI),M(0x183f99)); brim.position.set(0,2.24,0.4); brim.scale.set(1.1,1,0.8); g.add(brim); g.traverse(o=>{ if(o.isMesh) o.castShadow=true; }); return g; }
function frSpecFor(kind){ if(FREE_SPEC[kind]) return FREE_SPEC[kind]; return null; }
function frUseVehicle(kind){ // 換做呢款車嘅外型同性能
  const sp=FREE_SPEC[kind]; if(sp){ if(!SKB[kind]) SKB[kind]=()=>{ const g=carModel(kind); scene.remove(g); g.userData.blues=[]; return g; }; const L=LIVERY.find(l=>l.id===sp.id); if(!L) LIVERY.push(Object.assign({need:999,hidden:true,d:'',sw:'#ccc',col:0},sp)); applyLivery(sp.id); }
  else applyLivery(KIND2LIV[kind]||'yellow');
  store.set('livery',FRE.prevLiv); FRE.kind=kind; }
function startFree(){ ensureAudio(); chModeExit(); sirenSet(false); stopFireworks&&stopFireworks();
  if(S.gm!=='free') FRE.prevLiv=store.get('livery','yellow'); S.gm='free';
  S.level={id:'FREE',limit:9,tod:'day'}; S.kase={id:'free',title:'自由探索',tips:[],steps:[],loc:null};
  resetActors(); setTOD('day'); clearEvents(); frClear();
  // 喺屯門市廣場附近條街落地，路邊泊住幾部特別車俾你試
  const sp=taxiSpots().filter(s=>s.p[0]<200&&s.p[0]>-200&&s.p[1]>-200&&s.p[1]<300); const s0=sp[Math.random()*sp.length|0];
  Object.assign(S.car,{x:s0.p[0],z:s0.p[1],a:s0.face,v:0}); S.camYaw=S.car.a;
  Object.assign(S,{mode:'drive',step:'free',leftDepot:true,lives:5,collided:false,inX:-1,quizOpen:false,lastHit:-9,route:null,target:[S.car.x,S.car.z]});
  ring.visible=beacon.visible=arrow.visible=false; if(routeMesh) routeMesh.visible=false;
  const ux=Math.sin(s0.face+Math.PI/2), uz=Math.cos(s0.face+Math.PI/2);
  ['amb','police','fire','moto'].forEach((k,i)=>{ const x=s0.road[0]+ux*(i*9-13.5), z=s0.road[1]+uz*(i*9-13.5); frPark(k,x,z,s0.face+Math.PI/2); });
  S.spawnFree=true; for(let n=0;n<20;n++){ const kd=['taxi','car','bus','car','minibus','taxi','car'][n%7]; const c={m:carModel(kd),kind:kd}; if(placeCar(c,S.car.x,S.car.z)) cars.push(c); else dropModel(c.m); }
  for(let n=0;n<PED_N;n++){ const p={m:pedModel()}; if(placePed(p,S.car.x,S.car.z)) peds.push(p); else scene.remove(p.m); } S.spawnFree=false;
  FRE.p=frPlayer(); FRE.onFoot=true; FRE.y=0; FRE.vy=0; amb.visible=false; FRE.prevAeb=S.aeb; S.aeb=false; aebShow();
  $('lives').style.display='none'; show('menu',false); show('result',false); show('over',false); show('hudWrap',true); show('stabBox',false);
  frUI(); hud('🚶 自由探索',' · 行近車撳「上車」'); $('hDist').textContent='--'; $('hTime').textContent='--';
  caption('🚶 自由探索：周圍行吓！行近任何一部車撳「上車」'); setTimeout(()=>{ if(S.gm==='free') caption(null); },3500); }
function frPark(kind,x,z,a){ const m=frModel(kind); groundPose(m,x,0.1,z,a,m.userData.len||5); FRE.parked.push({m,kind,x,z,a}); }
function frClear(){ FRE.parked.forEach(q=>dropModel(q.m)); FRE.parked=[]; FRE.leavers.forEach(l=>scene.remove(l.m)); FRE.leavers=[]; if(FRE.p){ scene.remove(FRE.p); FRE.p=null; } }
function frUI(){ const foot=S.gm==='free'&&FRE.onFoot; document.body.classList.toggle('free-foot',foot); document.body.classList.toggle('free-car',S.gm==='free'&&!FRE.onFoot);
  $('bExit').style.display=S.gm==='free'&&!FRE.onFoot?'flex':'none'; }
function frNearest(){ const c=S.car; let best=null,bd=6.5;
  for(const k of cars){ if(!k.pose) continue; const d=Math.hypot(k.pose.x-c.x,k.pose.z-c.z)-(k.m.userData.len||4)/2*0.6; if(d<bd){ bd=d; best={t:'car',k}; } }
  for(const q of FRE.parked){ const d=Math.hypot(q.x-c.x,q.z-c.z)-(q.m.userData.len||4)/2*0.6; if(d<bd){ bd=d; best={t:'park',q}; } }
  return best; }
function frEnter(){ const n=FRE.cand; if(!n||!FRE.onFoot) return; const c=S.car; let kind,x,z,a;
  if(n.t==='car'){ const k=n.k; kind=k.kind||(k.m.userData.len>20?'bus':k.m.userData.len===7?'minibus':'car'); x=k.pose.x; z=k.pose.z; a=k.pose.a;
    const i=cars.indexOf(k); if(i>=0) cars.splice(i,1); dropModel(k.m);
    // 司機自己落車，行開幾步就走
    const dm=pedModel(); const sx=x+Math.sin(a+Math.PI/2)*2.6, sz=z+Math.cos(a+Math.PI/2)*2.6; dm.position.set(sx,ELEV(sx,sz),sz); FRE.leavers.push({m:dm,x:sx,z:sz,a:a+Math.PI/2+(Math.random()-0.5),t:0});
    toast('司機落咗車行開'); }
  else { const q=n.q; kind=q.kind; x=q.x; z=q.z; a=q.a; dropModel(q.m); FRE.parked.splice(FRE.parked.indexOf(q),1); }
  frUseVehicle(kind); amb.visible=true; scene.remove(FRE.p); FRE.onFoot=false; Object.assign(S.car,{x,z,a,v:0}); S.camYaw=a; FRE.cand=null; frUI();
  hud('🚗 '+(FREE_SPEC[kind]?FREE_SPEC[kind].name:VSPEC.name),' · 停車撳「落車」'); }
function frExit(){ if(FRE.onFoot) return; const c=S.car; if(Math.abs(c.v)>3){ toast('停定先落車'); return; } sirenSet(false);
  frPark(FRE.kind,c.x,c.z,c.a); amb.visible=false;
  let px=c.x+Math.sin(c.a+Math.PI/2)*3.2, pz=c.z+Math.cos(c.a+Math.PI/2)*3.2; if(cellAt(px,pz)&6){ px=c.x-Math.sin(c.a+Math.PI/2)*3.2; pz=c.z-Math.cos(c.a+Math.PI/2)*3.2; }
  FRE.p=frPlayer(); FRE.onFoot=true; FRE.y=0; FRE.vy=0; Object.assign(S.car,{x:px,z:pz,v:0}); frUI(); hud('🚶 自由探索',' · 行近車撳「上車」'); }
function frJump(){ if(FRE.onFoot&&FRE.y<=0.01){ FRE.vy=7; } }
// 每格：行路物理、上車提示、司機行開
function freeTick(dt,t){ const c=S.car; pedFlyTick(dt);
  FRE.leavers=FRE.leavers.filter(l=>{ l.t+=dt; l.x+=Math.sin(l.a)*2.4*dt; l.z+=Math.cos(l.a)*2.4*dt; l.m.position.set(l.x,ELEV(l.x,l.z),l.z); l.m.rotation.y=l.a; walk(l.m,t,true);
    if(l.t>5&&!inView(l.x,l.z,4)||l.t>12){ scene.remove(l.m); return false; } return true; });
  if(FRE.onFoot){ const H=S.hold, J=FRE.joy; let fwd=(H.G?1:0)-(H.B?1:0), side=(H.L?1:0)-(H.R?1:0); if(J.on){ fwd=-J.y; side=-J.x; }
    const mag=Math.min(1,Math.hypot(fwd,side)); const yaw=S.camYaw+S.camDrag.yaw;
    if(mag>0.08){ const mx=Math.sin(yaw)*fwd+Math.sin(yaw+Math.PI/2)*side, mz=Math.cos(yaw)*fwd+Math.cos(yaw+Math.PI/2)*side; const want=Math.atan2(mx,mz);
      c.a+=((want-c.a+Math.PI*3)%(Math.PI*2)-Math.PI)*Math.min(1,dt*10); const sp=7*mag, L=Math.hypot(mx,mz)||1; const nx=c.x+mx/L*sp*dt, nz=c.z+mz/L*sp*dt;
      if(!blockedAt(nx,c.z,6)) c.x=nx; if(!blockedAt(c.x,nz,6)) c.z=nz; }
    FRE.vy-=22*dt; FRE.y=Math.max(0,FRE.y+FRE.vy*dt); if(FRE.y===0) FRE.vy=0;
    FRE.p.position.set(c.x,ELEV(c.x,c.z)+FRE.y,c.z); FRE.p.rotation.y=c.a; walk(FRE.p,t,mag>0.08&&FRE.y===0);
    c.v=0; FRE.cand=frNearest(); $('bEnter').disabled=!FRE.cand; $('bEnter').classList.toggle('ready',!!FRE.cand);
    hud('🚶 自由探索',FRE.cand?' · 撳「上車」揸呢部車':' · 行近車撳「上車」'); }
  $('hDist').textContent=Math.round(Math.abs(c.v)*3.6)+' 公里/小時'; }
function freeExit(){ frClear(); amb.visible=true; FRE.onFoot=true; if(S.gm==='free'){ S.gm='ems'; applyLivery(FRE.prevLiv||'yellow'); store.set('livery',FRE.prevLiv||'yellow'); S.aeb=store.get('aeb',true); aebShow(); }
  document.body.classList.remove('free-foot','free-car'); $('bExit').style.display='none'; }
// 手機搖桿
{ const J=$('joy'), K=$('joyK'); let id=null, cx=0, cy=0; const R=46;
  J.addEventListener('pointerdown',e=>{ id=e.pointerId; const r=J.getBoundingClientRect(); cx=r.left+r.width/2; cy=r.top+r.height/2; FRE.joy.on=true; try{ J.setPointerCapture(id); }catch(_){} mv(e); e.preventDefault(); });
  const mv=e=>{ if(e.pointerId!==id) return; let dx=e.clientX-cx, dy=e.clientY-cy; const L=Math.hypot(dx,dy); if(L>R){ dx*=R/L; dy*=R/L; } K.style.transform='translate('+dx+'px,'+dy+'px)'; FRE.joy.x=dx/R; FRE.joy.y=dy/R; };
  J.addEventListener('pointermove',mv);
  ['pointerup','pointercancel'].forEach(ev=>J.addEventListener(ev,e=>{ if(e.pointerId!==id) return; id=null; FRE.joy.on=false; FRE.joy.x=FRE.joy.y=0; K.style.transform=''; })); }
$('bEnter').onclick=()=>frEnter(); $('bJump').onclick=()=>frJump(); $('bExit').onclick=()=>frExit();
addEventListener('keydown',e=>{ if(S.gm!=='free'||S.mode!=='drive') return; const tg=e.target; if(tg&&(tg.tagName==='INPUT'||tg.tagName==='TEXTAREA')) return;
  if(e.code==='KeyE'&&!e.repeat){ FRE.onFoot?frEnter():frExit(); } if(e.code==='Space'){ frJump(); e.preventDefault(); } });
window.__FR=FRE;

/* ================= CPR（測試）模式：人事不省、CPR + AED =================
   跟消防處「心肺復甦法及自動心臟除顫器簡介」嘅 4C 程序：冷靜 → 檢查 → 召喚 → CPR + AED
   教學模式：每步有解說同提示；練習模式：冇提示，做錯先提醒（唔計分）。                        */
const CP={on:false,mode:'teach',breaths:false,step:'',sub:0,t:0,warn:[],m:{},hot:[],comp:0,taps:[],set:0,pads:0,clear:false,dial:'',called:false,aedAsked:false,
  shoulders:0,shout:false,air:[false,false],brT:0,blow:0,rateWarned:false,metro:null,camMode:'walk',scanA:0,V:null,u:null,tv:null,jolt:0,amb:0};
const CPV={}; ['on','pads','analyse','shock','done','notouch'].forEach(k=>{ try{ const a=new Audio('cpr/'+k+'.mp3'); a.preload='auto'; CPV[k]=a; }catch(e){} });
function cpSay(k){ try{ Object.values(CPV).forEach(a=>{ a.pause(); a.currentTime=0; }); const a=CPV[k]; if(a){ a.currentTime=0; a.play().catch(()=>{}); } }catch(e){} }
function cpBeep(f,d,v){ if(!actx) return; try{ const o=actx.createOscillator(), g=actx.createGain(); o.frequency.value=f; o.type='sine'; g.gain.value=v||0.08; o.connect(g); g.connect(master); o.start(); g.gain.exponentialRampToValueAtTime(0.0001,actx.currentTime+d); o.stop(actx.currentTime+d+0.02); }catch(e){} }
function cpMetro(on){ if(CP.metro){ clearInterval(CP.metro); CP.metro=null; } if(on) CP.metro=setInterval(()=>cpBeep(1050,0.05,0.07),545); }   // 每分鐘 110 下
const $cp=id=>document.getElementById(id);
function cpEl(tag,cls,txt){ const e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }

/* ---------- 場景 ---------- */
/* ---------- 3D 模型：CPR 訓練公仔（似 Resusci Anne）、AED 機、電極片 ---------- */
const MK=1.35, MKY=0.2;   // 公仔放大比例；瞓低時背脊離地高度
function cpCanvas(w,h,fn){ const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d'); fn(g,w,h); const t=new THREE.CanvasTexture(c); t.anisotropy=4; return t; }
function cprr(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }
function chestTex(){ return cpCanvas(256,390,(g,w,h)=>{ const X=x=>(x+0.25)/0.5*w, Y=y=>(2.16-y)/0.76*h;
  const gr=g.createLinearGradient(0,0,w,0); gr.addColorStop(0,'#d9b393'); gr.addColorStop(0.18,'#ecccb0'); gr.addColorStop(0.82,'#ecccb0'); gr.addColorStop(1,'#d9b393'); g.fillStyle=gr; g.fillRect(0,0,w,h);
  g.lineCap='round'; g.lineJoin='round';
  // 鎖骨同胸骨上窩
  g.strokeStyle='rgba(150,100,70,.55)'; g.lineWidth=5; [-1,1].forEach(s=>{ g.beginPath(); g.moveTo(X(s*0.03),Y(2.085)); g.quadraticCurveTo(X(s*0.12),Y(2.05),X(s*0.24),Y(2.1)); g.stroke(); });
  g.fillStyle='rgba(150,100,70,.35)'; g.beginPath(); g.ellipse(X(0),Y(2.095),9,6,0,0,7); g.fill();
  // 胸骨（中線）同劍突
  g.strokeStyle='rgba(160,110,80,.35)'; g.lineWidth=9; g.beginPath(); g.moveTo(X(0),Y(2.07)); g.lineTo(X(0),Y(1.66)); g.stroke();
  g.fillStyle='rgba(150,100,70,.35)'; g.beginPath(); g.moveTo(X(-0.018),Y(1.665)); g.lineTo(X(0.018),Y(1.665)); g.lineTo(X(0),Y(1.62)); g.fill();
  // 胸肌下緣
  g.strokeStyle='rgba(140,90,60,.55)'; g.lineWidth=5; [-1,1].forEach(s=>{ g.beginPath(); g.moveTo(X(s*0.03),Y(1.79)); g.bezierCurveTo(X(s*0.1),Y(1.75),X(s*0.19),Y(1.77),X(s*0.235),Y(1.9)); g.stroke(); });
  // 乳頭同乳暈
  [-1,1].forEach(s=>{ g.fillStyle='#c98f74'; g.beginPath(); g.arc(X(s*0.11),Y(1.87),8,0,7); g.fill(); g.fillStyle='#a8674f'; g.beginPath(); g.arc(X(s*0.11),Y(1.87),3.5,0,7); g.fill(); });
  // 肋骨下緣（倒 V）同幾條肋骨陰影
  g.strokeStyle='rgba(140,90,60,.5)'; g.lineWidth=5; g.beginPath(); g.moveTo(X(-0.24),Y(1.5)); g.quadraticCurveTo(X(-0.1),Y(1.56),X(0),Y(1.63)); g.quadraticCurveTo(X(0.1),Y(1.56),X(0.24),Y(1.5)); g.stroke();
  g.strokeStyle='rgba(140,90,60,.22)'; g.lineWidth=3; [1.98,1.7,1.62].forEach(y=>[-1,1].forEach(s=>{ g.beginPath(); g.moveTo(X(s*0.05),Y(y)); g.quadraticCurveTo(X(s*0.16),Y(y-0.03),X(s*0.245),Y(y+0.02)); g.stroke(); }));
  // 腹部中線同肚臍
  g.strokeStyle='rgba(150,100,70,.18)'; g.lineWidth=3; g.beginPath(); g.moveTo(X(0),Y(1.6)); g.lineTo(X(0),Y(1.43)); g.stroke();
  g.fillStyle='#b98366'; g.beginPath(); g.ellipse(X(0),Y(1.42),4,6,0,0,7); g.fill(); }); }
function limb(p,a,b,r1,r2,mat){ const A=new THREE.Vector3(...a), B=new THREE.Vector3(...b), d=B.clone().sub(A), L=d.length();
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r2,r1,L,10),mat); m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()); p.add(m); return m; }
function handsModel(){ // 救人者雙手（第一身）：下面隻手掌根壓胸骨，上面隻手交疊、手指緊扣；手臂伸直，由救人者膊頭落嚟（+z 橫跨胸口，-z 係救人者嗰邊）
  const g=new THREE.Group(), sk=M(0xf1c9a5,{r:0.6}), sl=M(0x2f80ed,{r:0.7}), K=1.35;
  const palm=(y,ry)=>{ const h=new THREE.Group(); h.position.y=y; h.rotation.y=ry; g.add(h); add(rbox(0.17*K,0.055*K,0.2*K,0.03),sk,h,0,0,0);
    for(let i=0;i<4;i++){ const f=add(cyl(0.019*K,0.017*K,0.11*K,8),sk,h,(-0.06+i*0.04)*K,0,0.15*K,false); f.rotation.x=Math.PI/2; }
    const th=add(cyl(0.022*K,0.019*K,0.09*K,8),sk,h,0.1*K,0,0.02*K,false); th.rotation.z=Math.PI/2.5; return h; };
  palm(0.03,0); const top=palm(0.1,0.25); top.children.slice(1,5).forEach(f=>{ f.rotation.x=Math.PI/2+1.1; f.position.y-=0.05; f.position.z-=0.03; });
  [-1,1].forEach(sd=>{ const w=[sd*0.07*K,0.08,-0.08*K], el=[sd*0.13*K,0.55,-0.32*K], sh=[sd*0.22*K,1.15,-0.6*K];
    limb(g,w,el,0.05*K,0.045*K,sk); limb(g,[el[0],el[1]-0.06,el[2]+0.03],sh,0.075*K,0.085*K,sl); });   // 前臂（皮）、上臂（衫袖），手肘伸直
  g.visible=false; return g; }
function manikinModel(){ // 企喺度嘅座標：y 向上、面向 +z；全身約 2.6 × MK
  const g=new THREE.Group(), skin=M(0xeccbb0,{r:0.55}), skinD=M(0xd9b090,{r:0.6}), suit=M(0x2a5db0,{r:0.7}), hair=M(0x8a5a3c,{r:0.5}), dark=M(0x3a2a2a);
  // 腳（藍色運動褲）同鞋
  [-0.13,0.13].forEach(x=>{ add(cyl(0.115,0.1,1.08,12),suit,g,x,0.62,0); add(rbox(0.2,0.12,0.32,0.05),M(0x222831),g,x,0.06,0.06); });
  add(rbox(0.48,0.3,0.3,0.1),suit,g,0,1.28,0);                    // 盆骨
  // 胸腹：赤裸膠皮（可以貼電極片），胸前有乳頭同胸骨位
  const torso=add(rbox(0.52,0.78,0.3,0.12),skin,g,0,1.78,0); g.userData.torso=torso;
  // 胸口貼圖：鎖骨、胸骨、胸肌輪廓、乳頭、肋骨下緣、劍突、肚臍（貼喺身軀前面，按壓時跟住壓落）
  const chest=new THREE.Mesh(new THREE.PlaneGeometry(0.5,0.76),new THREE.MeshStandardMaterial({map:chestTex(),roughness:0.55})); chest.position.set(0,0,0.151); torso.add(chest);
  add(rbox(0.6,0.16,0.28,0.07),skin,g,0,2.12,0);                  // 膊頭
  add(cyl(0.075,0.085,0.16,10),skin,g,0,2.25,0);                  // 頸
  // 手：上臂、前臂同手掌
  const arms=[-1,1].map(s=>{ const a=new THREE.Group(); a.position.set(s*0.33,2.1,0); g.add(a); add(cyl(0.075,0.068,0.42,10),skin,a,0,-0.21,0); add(cyl(0.065,0.055,0.4,10),skin,a,0,-0.62,0); add(sph(0.07),skin,a,0,-0.86,0); return a; });
  // 頭：膠面、閉眼、鼻、張開嘅口（做人工呼吸）、膠頭髮
  const head=new THREE.Group(); head.position.set(0,2.47,0); g.add(head);
  const hd=add(sph(0.19),skin,head,0,0,0); hd.scale.set(0.9,1.12,1);
  const hr=add(new THREE.SphereGeometry(0.195,20,12,0,Math.PI*2,0,Math.PI*0.55),hair,head,0,0.02,-0.015,false); hr.scale.set(0.93,1.15,1.03);
  [-0.06,0.06].forEach(x=>{ const e=add(new THREE.BoxGeometry(0.055,0.008,0.01),dark,head,x,0.03,0.172,false); });
  add(new THREE.ConeGeometry(0.03,0.07,8),skinD,head,0,-0.01,0.19,false).rotation.x=Math.PI/2;
  const mo=add(new THREE.CircleGeometry(0.03,12),M(0x5a2a2a),head,0,-0.085,0.171,false); mo.scale.set(1.3,0.8,1);
  // 上衣（用 AED 前要除去）：淺灰白色 polo，有領同短袖
  const shirt=new THREE.Group(); g.add(shirt); const sm=M(0xe9edf2,{r:0.8}), sc=M(0x2a5db0,{r:0.7});
  add(rbox(0.57,0.82,0.35,0.13),sm,shirt,0,1.77,0); add(rbox(0.64,0.18,0.31,0.08),sm,shirt,0,2.12,0);
  add(rbox(0.2,0.05,0.04,0.02),sc,shirt,0,2.2,0.15,false); add(rbox(0.04,0.2,0.02,0.01),sc,shirt,0,2.08,0.18,false);
  arms.forEach(a=>add(cyl(0.095,0.09,0.22,10),sm,a,0,-0.1,0));
  g.userData.arms=arms; g.userData.head=head; g.userData.shirt=shirt; g.scale.setScalar(MK); return g; }
// 公仔身上嘅位置（企喺度座標）。電極片：右邊鎖骨下、胸骨右側；左邊腋中線、約第 5–6 肋間（乳頭水平以下、貼喺側邊）
const CPPT={ shL:[0.27,2.1,0.12], shR:[-0.27,2.1,0.12], fore:[0,2.6,0.16], chin:[0,2.3,0.15],
  chUp:[0,2.06,0.16], chMid:[0,1.86,0.17], belly:[0,1.46,0.16],
  padA:[-0.125,1.96,0.16], padB:[0.262,1.7,0.04], padX:[0.125,1.96,0.16], padY:[0,1.42,0.16], padZ:[0.11,1.72,0.16] };
const PADPOSE={ padA:{p:[-0.125,1.955,0.153],ry:0,rz:-0.12}, padB:{p:[0.264,1.7,0.0],ry:Math.PI/2,rz:0} };   // 第一塊：上緣喺鎖骨下面、內緣喺胸骨右邊；第二塊：左腋中線、乳頭水平以下，直放   // 貼片喺公仔局部座標嘅位置同方向
// 電極片：白色片、藍色／紅色框、印住簡單貼位圖（參考用戶提供嘅 AED 圖片）
function padTex(n){ const col=n===1?'#2b6fd6':'#d8323c'; return cpCanvas(256,320,(g,w,h)=>{ g.fillStyle='#fbfbfc'; cprr(g,4,4,w-8,h-8,46); g.fill(); g.strokeStyle='#d5dae0'; g.lineWidth=4; g.stroke();
  g.strokeStyle=col; g.lineWidth=7; cprr(g,30,44,w-60,h-80,34); g.stroke();
  g.strokeStyle=col; g.lineWidth=4; g.beginPath(); g.arc(128,110,20,0,7); g.stroke(); cprr(g,84,136,88,110,22); g.stroke();
  g.fillStyle=col; g.globalAlpha=0.85; if(n===1) cprr(g,94,146,26,34,5); else cprr(g,148,180,16,40,5); g.fill(); g.globalAlpha=1;
  g.fillStyle=col; g.font='bold 34px sans-serif'; g.textAlign='center'; g.fillText(n,128,286);
  g.fillStyle='#e6e9ec'; g.beginPath(); g.arc(128,14,10,0,7); g.fill(); }); }
const PADT=[null,padTex(1),padTex(2)];
// 機面螢幕：教學插圖（貼片位置＋按壓），自己畫，冇品牌
function aedScreenTex(){ return cpCanvas(512,300,(g,w,h)=>{ g.fillStyle='#f6a43a'; g.fillRect(0,0,w,h); g.fillStyle='#ffe2b8'; g.fillRect(6,6,w/2-9,h-12); g.fillRect(w/2+3,6,w/2-9,h-12);
  g.fillStyle='#f2c9a6'; g.strokeStyle='#8a5a3a'; g.lineWidth=3; g.beginPath(); g.arc(128,70,30,0,7); g.fill(); g.stroke(); cprr(g,70,104,116,170,28); g.fill(); g.stroke();
  g.fillStyle='#fff'; g.strokeStyle='#e06a00'; g.lineWidth=3; cprr(g,82,118,32,38,5); g.fill(); g.stroke(); cprr(g,150,158,24,44,5); g.fill(); g.stroke();
  g.fillStyle='#2b6fd6'; g.beginPath(); g.arc(320,190,14,0,7); g.fill(); g.fillStyle='#fff'; g.fillRect(300,198,170,40); g.fillStyle='#f2c9a6'; g.beginPath(); g.arc(436,90,26,0,7); g.fill(); g.stroke();
  g.strokeStyle='#5b6a80'; g.lineWidth=14; g.beginPath(); g.moveTo(426,118); g.lineTo(370,190); g.stroke(); g.fillStyle='#fff'; g.beginPath(); g.arc(370,196,14,0,7); g.fill(); }); }
function aedLidTex(){ return cpCanvas(512,560,(g,w,h)=>{ g.fillStyle='#f39a1e'; g.fillRect(0,0,w,h);
  g.fillStyle='#e48a10'; cprr(g,40,30,w-80,90,30); g.fill(); g.fillStyle='#3a3a3a'; cprr(g,120,48,w-240,52,22); g.fill();   // 手挽位
  g.fillStyle='#fff'; g.beginPath(); g.moveTo(256,150); g.lineTo(236,176); g.lineTo(276,176); g.fill();   // 箭咀
  g.fillStyle='#dfe7f5'; cprr(g,170,200,172,40,8); g.fill(); g.fillStyle='#1d3f86'; g.font='bold 24px sans-serif'; g.textAlign='center'; g.fillText('⌛ 2026-11-18',256,229);
  g.strokeStyle='#fff'; g.lineWidth=12; g.lineJoin='round'; g.beginPath(); g.moveTo(256,470); g.bezierCurveTo(150,400,150,290,212,290); g.bezierCurveTo(240,290,256,310,256,326); g.bezierCurveTo(256,310,272,290,300,290); g.bezierCurveTo(362,290,362,400,256,470); g.stroke();
  g.fillStyle='#fff'; g.beginPath(); g.moveTo(262,320); g.lineTo(234,384); g.lineTo(258,384); g.lineTo(246,436); g.lineTo(284,368); g.lineTo(260,368); g.lineTo(276,320); g.fill();
  g.font='bold 64px sans-serif'; g.fillText('AED',256,540); }); }
function aedFaceTex(){ return cpCanvas(512,560,(g,w,h)=>{ g.fillStyle='#f39a1e'; g.fillRect(0,0,w,h); g.fillStyle='#6b7079'; cprr(g,22,22,w-44,h-150,26); g.fill();
  g.fillStyle='#dfe2e6'; g.font='bold 24px sans-serif'; g.textAlign='center'; g.fillText('AED',256,58);
  g.fillStyle='#3d4148'; for(let r=0;r<7;r++) for(let c=0;c<7;c++){ const x=62+c*12, y=300+r*12; if((x-98)**2+(y-336)**2<1500){ g.beginPath(); g.arc(x,y,3.6,0,7); g.fill(); } }   // 喇叭
  g.fillStyle='#2b2d31'; cprr(g,40,454,w-80,74,22); g.fill(); g.fillStyle='#4a4d52'; cprr(g,196,466,120,26,8); g.fill();   // 前面手挽位
  g.fillStyle='#4a4f57'; cprr(g,404,92,60,30,6); g.fill(); cprr(g,404,134,60,30,6); g.fill(); g.fillStyle='#fff'; g.font='bold 18px sans-serif'; g.fillText('i',434,113); g.fillText('成人/兒童',434,180); }); }
let AEDT=null;
function aedModel(small){ if(!AEDT){ AEDT={face:aedFaceTex(),lid:aedLidTex(),scr:aedScreenTex()}; }
  const g=new THREE.Group(), orange=M(0xf39a1e,{r:0.45}), grey=M(0x6b7079,{r:0.55}), dark=M(0x2b2d31,{r:0.7});
  add(rbox(0.92,0.24,1.0,0.12),orange,g,0,0.12,0);                                       // 橙色機身
  add(rbox(0.94,0.06,1.02,0.04),M(0x4a4d52,{r:0.7}),g,0,0.03,0,false);                     // 底部深灰膠邊
  const face=new THREE.Mesh(new THREE.PlaneGeometry(0.88,0.96),new THREE.MeshStandardMaterial({map:AEDT.face,roughness:0.5})); face.rotation.x=-Math.PI/2; face.position.set(0,0.242,0.01); g.add(face);
  const scr=new THREE.Mesh(new THREE.PlaneGeometry(0.5,0.3),new THREE.MeshBasicMaterial({map:AEDT.scr})); scr.rotation.x=-Math.PI/2; scr.position.set(0.04,0.246,-0.12); g.add(scr);
  // 橙色電擊掣（三角形、有閃電）
  const shk=new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.085,0.04,3),new THREE.MeshBasicMaterial({color:0xb4560a})); shk.position.set(0,0.262,0.17); shk.rotation.y=Math.PI; g.add(shk);
  const bolt=new THREE.Mesh(new THREE.PlaneGeometry(0.08,0.08),new THREE.MeshBasicMaterial({map:cpCanvas(64,64,(c)=>{ c.fillStyle='#fff'; c.font='bold 48px sans-serif'; c.textAlign='center'; c.fillText('⚡',32,50); }),transparent:true}));
  bolt.rotation.x=-Math.PI/2; bolt.position.set(0,0.284,0.18); g.add(bolt);
  const ready=add(sph(0.016),new THREE.MeshBasicMaterial({color:0x1d3a24}),g,0.31,0.25,0.08,false);   // 就緒燈
  // 左上角電極插頭（藍色）
  const port=add(rbox(0.07,0.05,0.07,0.02),M(0x2b6fd6,{r:0.4}),g,-0.36,0.27,-0.42,false);
  // 機蓋：鉸喺後面，打開即自動開機；外面有心形閃電標誌同「AED」，裏面有窗位
  const lid=new THREE.Group(); lid.position.set(0,0.24,-0.5); g.add(lid);
  add(rbox(0.92,0.08,1.0,0.06),orange,lid,0,0.04,0.5,false);
  const lo=new THREE.Mesh(new THREE.PlaneGeometry(0.86,0.94),new THREE.MeshStandardMaterial({map:AEDT.lid,roughness:0.5})); lo.rotation.x=-Math.PI/2; lo.rotation.z=Math.PI; lo.position.set(0,0.082,0.5); lid.add(lo);
  const win=add(rbox(0.26,0.02,0.12,0.03),M(0xf6f6f2,{r:0.4}),lid,0,-0.005,0.62,false);
  // 電極片包（未用時放喺機面上）
  const pk=new THREE.Mesh(new THREE.PlaneGeometry(0.2,0.25),new THREE.MeshStandardMaterial({map:PADT[1]})); pk.rotation.x=-Math.PI/2; pk.position.set(-0.3,0.25,-0.3); pk.visible=false; g.add(pk);
  g.userData={led:ready,leds:[],shk,port,lid,pk}; if(small){ g.scale.setScalar(0.62); } return g; }
function aedOpen(A,f){ A.userData.lid.rotation.x=-1.95*f; }
function cpW(lx,ly,lz){ const v=new THREE.Vector3(lx,ly,lz); CP.m.vp.localToWorld(v); return v; }   // 公仔局部座標 → 世界座標
function cpBuild(){
  const L=LMK.plaza; const V=L.patient, st=L.stop; let ux=V[0]-st[0], uz=V[1]-st[1]; const n=Math.hypot(ux,uz)||1; ux/=n; uz/=n;
  CP.V=V; CP.u=[ux,uz]; CP.tv=[uz,-ux];   // u：由馬路指向行人路；tv：沿住行人路（病人頭嘅方向）
  const vic=new THREE.Group(); scene.add(vic); vic.position.set(V[0],0.12,V[1]); vic.rotation.y=Math.atan2(-CP.tv[0],-CP.tv[1]);
  const p=manikinModel(); vic.add(p); p.position.set(0,0,0); p.userData.stand=true;   // 開頭企喺度，暈低先瞓低
  CP.m.vic=vic; CP.m.vp=p;
  const me=person('bystander'); me.children[0].material.color.set(0x2f80ed); scene.add(me); CP.m.me=me;
  const hp=person('bystander'); hp.children[0].material.color.set(0x34b37a); scene.add(hp); CP.m.hp=hp; hp.visible=false;
  const aed=aedModel(false); scene.add(aed); aed.visible=false; CP.m.aed=aed; CP.m.pads=[];
  CP.m.hands=handsModel(); scene.add(CP.m.hands);
  CP.m.carry=aedModel(true); hp.add(CP.m.carry); CP.m.carry.position.set(0.85,0.75,0.2); CP.m.carry.rotation.z=Math.PI/2;
}
function cpDrop(){ ['vic','me','hp','aed','hands'].forEach(k=>{ const g=CP.m[k]; if(g) scene.remove(g); }); (CP.m.pads||[]).forEach(p=>p.parent&&p.parent.remove(p)); CP.m={}; }
function cpLay(){ const p=CP.m.vp; p.rotation.x=-Math.PI/2; p.position.set(0,MKY*MK,0); p.userData.stand=false; p.userData.arms.forEach((a,i)=>{ a.rotation.x=0; a.rotation.z=(i?1:-1)*0.6; }); }
function cpPlace(g,wx,wz,face,kneel){ g.position.set(wx,kneel?-0.55:0.12,wz); g.rotation.y=face; g.userData.legL.rotation.x=kneel?1.5:0; g.userData.legR.rotation.x=kneel?1.5:0; }
function cpKneelSpots(){ const C=cpW(...CPPT.chMid); const u=CP.u;
  return {me:[C.x-u[0]*1.45,C.z-u[1]*1.45], hp:[C.x+u[0]*1.7+CP.tv[0]*1.5,C.z+u[1]*1.7+CP.tv[1]*1.5], C}; }

/* ---------- 介面 ---------- */
function cpUI(){ let w=$cp('cp'); if(w) return w;
  w=cpEl('div',null); w.id='cp'; w.innerHTML='<div class="cpchip" id="cpChip"></div><div class="cptxt" id="cpTxt"></div><div class="cpgauge" id="cpGauge"><b id="cpRate">--</b><span>下／分鐘</span><i><em id="cpBar"></em></i><span id="cpCnt"></span></div><div class="cpact" id="cpAct"></div>';
  document.body.append(w); const h=cpEl('div',null); h.id='cpHot'; document.body.append(h); const r=cpEl('div',null); r.id='cpWarn'; document.body.append(r); return w; }
function cpSet(chip,teach,practice,acts){ cpUI(); $cp('cpChip').textContent=chip; const tx=$cp('cpTxt'); tx.textContent=CP.mode==='teach'?teach:(practice||teach); if(CP.note){ const n=cpEl('b','cpnote',CP.note); tx.prepend(n); CP.note=''; }
  const A=$cp('cpAct'); A.innerHTML=''; (acts||[]).forEach(a=>{ const b=cpEl('button','cpb'+(a.cls?' '+a.cls:''),a.t); if(a.ok) b.classList.add('hint'); b.onclick=()=>a.fn(b); A.append(b); }); $cp('cpGauge').style.display='none'; }
function cpHot(list){ // list: [{k:'shL',t:'膊頭',ok:true,fn}]
  const H=$cp('cpHot'); H.innerHTML=''; CP.hot=list.map(h=>{ const b=cpEl('button','cph'+(h.ok?' hint':''),h.t||''); b.onclick=()=>h.fn(b); H.append(b); return {b,h}; }); }
function cpBubble(txt){ let b=$cp('cpBub'); if(!b){ b=cpEl('div',null); b.id='cpBub'; document.body.append(b); } b.textContent=txt; b.style.display='block'; CP.bubT=2.2; }
function cpWarn(txt){ // 做錯：提醒（教學同練習都會出）
  if(!CP.warn.includes(txt)) CP.warn.push(txt); const w=$cp('cpWarn'); w.textContent='⚠️ '+txt; w.classList.remove('show'); void w.offsetWidth; w.classList.add('show');
  clearTimeout(CP.wT); CP.wT=setTimeout(()=>w.classList.remove('show'),4200); cpBeep(330,0.25,0.09); vib(80); }
function cpOK(){ cpBeep(880,0.12,0.06); }

/* ---------- 開始／結束 ---------- */
function startCPR(mode,breaths){ ensureAudio(); chModeExit(); sirenSet(false); stopFireworks&&stopFireworks(); show('menu',false); show('result',false); show('over',false);
  S.gm='cpr'; S.mode='cpr'; S.level={id:'CPR',limit:9,tod:'day'}; S.kase={id:'cpr',title:'CPR（測試）',tips:[],steps:[],loc:null};
  cpDrop(); { const L=LMK.plaza; Object.assign(S.car,{x:L.stop[0],z:L.stop[1],v:0}); } resetActors(); setTOD('day'); clearEvents(); ring.visible=beacon.visible=arrow.visible=false; if(routeMesh) routeMesh.visible=false;
  Object.assign(CP,{on:true,mode,breaths:!!breaths,helperRun:0,aedOn:0,aedLid:0,shocked:0,warn:[],t:0,comp:0,taps:[],set:0,pads:0,clear:false,dial:'',called:false,aedAsked:false,shoulders:0,shout:false,air:[false,false],brT:0,blow:0,rateWarned:false,jolt:0,amb:0});
  cpDrop(); cpBuild(); amb.visible=false; if(S.camDrag){ S.camDrag.yaw=0; S.camDrag.pitch=0; } document.body.classList.add('cpr'); show('hudWrap',true); cpUI(); $cp('cp').style.display='block';
  // 你喺 14 米外行緊街，佢喺前面
  const V=CP.V, tv=CP.tv; const sx=V[0]+tv[0]*16, sz=V[1]+tv[1]*16; cpPlace(CP.m.me,sx,sz,Math.atan2(-tv[0],-tv[1]),false);
  CP.camMode='walk'; CP.snap=true; cpStep('walk'); }
function cprExit(){ S.gm='ems'; cpMetro(false); if(CP.vo){ cam.clearViewOffset(); CP.vo=0; } $('rName').style.display=''; $('rSave').style.display=''; CP.on=false; cpDrop(); amb.visible=true; document.body.classList.remove('cpr'); const w=$cp('cp'); if(w) w.style.display='none'; const h=$cp('cpHot'); if(h) h.innerHTML='';
  const r=$cp('cpWarn'); if(r) r.classList.remove('show'); const bb=$cp('cpBub'); if(bb) bb.style.display='none'; try{ Object.values(CPV).forEach(a=>a.pause()); }catch(e){} sirenSet(false); }

/* ---------- 步驟 ---------- */
function cpStep(s){ CP.step=s; CP.sub=0; CP.t=0; cpHot([]); const T=CP.mode==='teach';
  if(s==='walk'){ cpSet('🚶 行街','你喺屯門市廣場外面行街，前面有位先生……','你喺屯門市廣場外面行街……',[]); return; }
  if(s==='calm'){ CP.camMode='look';
    cpSet('① 冷靜 Calm','前面嘅先生突然暈低，冇反應！第一步係「冷靜」：先睇清楚現場環境安唔安全（例如有冇車、電線、跌落物），同埋諗吓佢點解會暈低（損傷過程），先好上前。','前面有人突然暈低！你第一步會點做？',[
      {t:'👀 先睇清楚四周環境安唔安全',ok:true,fn:()=>{ cpOK(); CP.camMode='scan'; CP.scanA=0; CP.scan0=Math.atan2(cam.position.x-CP.V[0],cam.position.z-CP.V[1]); cpSet('① 冷靜 Calm','睇緊四周……行人路上冇車駛近、冇電線、冇跌落物，環境安全。','睇緊四周……',[]); }},
      {t:'🏃 即刻衝埋去拍醒佢',fn:()=>cpWarn('未確定環境安全就衝埋去，自己都可能受傷。先冷靜，睇清楚四周有冇危險。')},
      {t:'📱 拎電話出嚟影相',fn:()=>cpWarn('救人要緊，唔好影相。先確定環境安全，再上前檢查。')}]); return; }
  // ② 檢查：先大聲叫 → 再拍膊頭
  if(s==='check'){ CP.camMode='kneel';
    cpSet('② 檢查 1/2：叫佢','先大聲叫佢：「先生，你有冇事呀？」睇佢有冇反應。','先做咩？',[
      {t:'🗣️ 大聲叫：「先生，你有冇事呀？」',ok:true,fn:()=>{ cpOK(); CP.note='🗣️「先生，你有冇事呀？」…… 冇反應。'; cpStep('tap'); }},
      {t:'🤲 用力搖佢個頭',fn:()=>cpWarn('唔好搖病人個頭，佢可能傷咗頸。應該大聲叫佢，再輕拍兩邊膊頭。')},
      {t:'🪑 扶佢坐起身',fn:()=>cpWarn('唔好隨便郁動病人。先大聲叫佢，再輕拍膊頭，確定佢有冇反應。')}]); return; }
  if(s==='tap'){ CP.shoulders=0;
    cpSet('② 檢查 2/2：拍膊頭','冇反應。再輕拍佢兩邊膊頭。撳佢兩邊膊頭。','輕拍佢兩邊膊頭。',[]);
    const sh=b=>{ if(b.dataset.done) return; b.dataset.done=1; b.classList.add('done'); CP.shoulders++; cpOK(); if(CP.shoulders>=2){ cpHot([]); setTimeout(()=>{ if(CP.step==='tap'){ CP.note='冇反應：人事不省！'; cpStep('call'); } },500); } };
    cpHot([{k:'shL',t:'拍',ok:true,fn:sh},{k:'shR',t:'拍',ok:true,fn:sh},{k:'fore',t:'',fn:()=>cpWarn('唔好拍頭。應該輕拍兩邊膊頭。')}]); return; }
  // ③ 召喚：先打 999 → 再叫人攞 AED
  if(s==='call'){ CP.m.hp.visible=true; CP.camMode='helper'; const C=cpKneelSpots().C; cpPlace(CP.m.hp,C.x+CP.u[0]*6+CP.tv[0]*3,C.z+CP.u[1]*6+CP.tv[1]*3,Math.atan2(-CP.u[0],-CP.u[1]),false); CP.m.carry.visible=false;
    cpSet('③ 召喚 Call','佢人事不省！你要留低救人，所以指定旁邊一位途人幫手：叫佢打 999 叫救護車，再去攞 AED，搵唔搵到都要返嚟幫手。要指住一個人、講清楚。','佢冇反應。你會點做？',[
      {t:'👉 指住途人：「你！幫我打 999 叫救護車，再去攞 AED，搵唔搵到都返嚟幫手！」',ok:true,fn:()=>{ cpOK(); cpBubble('好的！'); cpHot([]); $cp('cpAct').innerHTML='';
        setTimeout(()=>{ if(CP.step!=='call') return; CP.helperRun=1; CP.note='途人：「好的！」佢一路打 999，一路去攞 AED。'; cpStep('airway'); },1600); }},
      {t:'📣 對住人群叫：「有冇人幫手呀？」',fn:()=>cpWarn('對住人群叫，大家都以為其他人會幫手。要指住一個人，叫佢打 999、去攞 AED，搵唔搵到都返嚟。')},
      {t:'🏃 自己走開去打電話、搵 AED',fn:()=>cpWarn('唔好留低病人自己走開。叫途人幫你打 999 同攞 AED，你留低準備做 CPR。')},
      {t:'⏳ 等佢自己醒',fn:()=>cpWarn('人事不省唔會自己醒！要即刻叫人打 999 同攞 AED。每遲一分鐘，存活機會跌 7 至 10%。')}]); return; }
  // ④ 打開氣道：先按額頭 → 再托下巴 → 檢查呼吸
  if(s==='airway'){ CP.camMode='kneel';
    cpSet('④ 打開氣道 1/2：按額頭','人事不省時條脷會向後跌，塞住氣道。先用一隻手按住佢額頭。','打開氣道：手放邊度？',[]);
    cpHot([{k:'fore',t:'額頭',ok:true,fn:()=>{ cpOK(); cpStep('chin'); }},{k:'chMid',t:'',fn:()=>cpWarn('未打開氣道、未檢查呼吸，唔好住開始按壓。先按額頭打開氣道。')},{k:'chin',t:'',fn:()=>cpWarn('次序：先用一隻手按住額頭，再用另一隻手托起下巴。')}]); return; }
  if(s==='chin'){
    cpSet('④ 打開氣道 2/2：托下巴','另一隻手托起佢下巴，令個頭向後仰，打開氣道。','另一隻手放邊度？',[]);
    cpHot([{k:'chin',t:'下巴',ok:true,fn:()=>{ cpOK(); cpStep('breath'); }},{k:'chMid',t:'',fn:()=>cpWarn('仲未完成打開氣道。另一隻手托起下巴。')}]); return; }
  if(s==='breath'){ CP.brT=0;
    cpSet('④ 檢查呼吸（少過 10 秒）','望住佢胸口有冇起伏，聽吓有冇呼吸聲，用少過 10 秒判斷有冇「有效」呼吸。只係偶爾喘氣唔算有效呼吸。','檢查呼吸。佢有冇有效呼吸？',[
      {t:'😮‍💨 有正常呼吸',fn:()=>cpWarn('佢胸口完全冇起伏，冇有效呼吸。偶爾喘氣都唔算！應該當心臟停頓，即刻開始 CPR。')},
      {t:'🚫 冇有效呼吸',ok:true,fn:()=>{ if(CP.brT>10) cpWarn('檢查呼吸用咗超過 10 秒。要少過 10 秒就決定，唔好拖延開始 CPR 嘅時間。'); cpOK(); cpStep('hands'); }}]); return; }
  if(s==='hands'){
    cpSet('⑤ 按壓位置','冇有效呼吸 → 確定心臟停頓，即刻做 CPR！先確保佢仰臥喺硬嘅平地上。按壓位置係兩個乳頭連線嘅中央，雙手交疊、手指緊扣，用掌根向下壓。','手放喺邊度按？',[]);
    cpHot([{k:'chUp',t:'',fn:()=>cpWarn('太高喇。按壓位置係兩個乳頭連線嘅中央。')},{k:'chMid',t:'',ok:true,fn:()=>{ cpOK(); cpStep('comp'); }},{k:'belly',t:'',fn:()=>cpWarn('太低喇，按落肚會整傷內臟。按壓位置係兩個乳頭連線嘅中央。')}]); return; }
  if(s==='comp'){ CP.comp=0; CP.taps=[]; CP.rateWarned=false; CP.lastMsg='';
    const after=CP.set===0?'按完 30 下途人就會攞 AED 嚟。':CP.set===1?'按完 30 下救護車就會到。':'';
    cpSet('⑤ 心肺復甦 CPR','跟住「嘀」聲節奏，連續撳「按壓」（或者空白鍵）30 下。快：每分鐘 100 至 120 下；狠：壓落 5 至 6 公分；準：雙手伸直，每下等胸口完全彈返先再壓。'+after,'開始胸外按壓，撳「按壓」或者空白鍵 30 下。',[
      {t:'🫸 按壓',cls:'big',ok:true,fn:()=>cpPress()}]);
    $cp('cpGauge').style.display='flex'; cpGauge(); if(CP.mode==='teach') cpMetro(true); return; }
  if(s==='rescue'){
    cpSet('⑤ 人工呼吸 1/3：按額頭','30 下按壓之後做 2 次人工呼吸。先按額頭打開氣道。','30 下按完。下一步？',[]);
    cpHot([{k:'fore',t:'額頭',ok:true,fn:()=>{ cpOK(); cpStep('rescue2'); }},{k:'chMid',t:'',fn:()=>cpWarn('揀咗 30:2，按完 30 下要先做 2 次人工呼吸：先按額頭打開氣道。')}]); return; }
  if(s==='rescue2'){
    cpSet('⑤ 人工呼吸 2/3：托下巴','另一隻手托起下巴，打開氣道。','另一隻手放邊度？',[]);
    cpHot([{k:'chin',t:'下巴',ok:true,fn:()=>{ cpOK(); cpStep('rescue3'); }}]); return; }
  if(s==='rescue3'){ CP.blow=0;
    cpSet('⑤ 人工呼吸 3/3：吹氣','吹兩啖氣，每啖大約 1 秒，見到胸口升起就得。撳「吹氣」兩次。','吹氣。',[
      {t:'💨 吹氣',ok:true,fn:b=>{ CP.blow++; cpOK(); b.textContent='💨 吹氣（'+CP.blow+' / 2）'; if(CP.blow>=2){ b.disabled=true; setTimeout(()=>{ if(CP.step==='rescue3') cpAfterSet(); },400); } }}]); return; }
  if(s==='aedArrive'){ cpMetro(false); CP.camMode='kneel'; const K=cpKneelSpots(); cpPlace(CP.m.hp,K.hp[0],K.hp[1],Math.atan2(-CP.u[0],-CP.u[1]),true); CP.m.carry.visible=false; CP.m.hp.userData.arms.forEach(x=>x.rotation.x=-0.8);
    const A=CP.m.aed; A.visible=true; aedOpen(A,0); const H=cpW(0.8,2.4,0); A.position.set(H.x,0.12,H.z); A.rotation.y=CP.m.vic.rotation.y;
    cpSet('⑥ AED 到咗','途人攞咗 AED 嚟！呢部 AED 打開機蓋就會自動開機，之後跟住語音一步步做：開機 → 貼電極片 → 分析及電擊。','AED 到咗。',[]);
    cpAED({closed:true,lcd:'',powerHint:true,power:()=>{ if(CP.aedOn) return; CP.aedOn=1; cpOK(); cpSay('on');  setTimeout(()=>{ if(CP.step==='aedArrive'){ cpSay('pads'); cpStep('strip'); } },1700); },
      shock:()=>cpWarn('未開機、未貼電極片，AED 未分析心律，唔可以電擊。先撳綠色掣開機。')}); return; }
  if(s==='strip'){
    cpSet('⑥ 除去上衣','AED 話「將電極片貼喺病人赤裸嘅胸口」。電極片唔可以隔住衫貼：先解開或者剪開病人上衣，露出成個胸口（胸口濕就要抹乾）。','AED 要求貼喺赤裸嘅胸口。下一步？',[
      {t:'✂️ 剪開／解開上衣，露出胸口',ok:true,fn:()=>{ cpOK(); CP.m.vp.userData.shirt.visible=false; CP.note='上衣已經剪開，露出胸口。'; cpStep('pads'); }},
      {t:'🩹 隔住件衫貼電極片',fn:()=>cpWarn('電極片唔可以隔住衫貼，電流過唔到！要先解開或者剪開上衣，貼喺赤裸、乾爽嘅皮膚。')},
      {t:'🧍 扶病人坐起身除衫',fn:()=>cpWarn('唔好扶病人起身除衫，會延誤電擊同按壓。直接解開或者剪開上衣就得。')}]);
    cpAED({lcd:'將電極片貼喺病人赤裸嘅胸口',shock:()=>cpWarn('電極片未貼好，AED 未分析心律，唔可以電擊。')}); return; }
  if(s==='pads'){
    cpSet('⑥ 貼電極片 1/2','撕開電極片，按片上面嘅圖示，貼喺病人赤裸、乾爽嘅皮膚。第一塊：病人右邊鎖骨下面、胸骨右側（即係你望落去嘅左手邊）。','貼第一塊電極片。',[]);
    cpAED({lcd:'將電極片貼喺病人赤裸嘅胸口',info:'第一塊：病人右邊鎖骨下面、胸骨右側。',pad:1,shock:()=>cpWarn('電極片未貼好，AED 未分析心律，唔可以電擊。')});
    cpHot([{k:'padA',t:'',ok:true,fn:()=>{ cpOK(); cpPad('padA'); cpStep('pads2'); }},
      {k:'padX',t:'',fn:()=>cpWarn('呢度係病人左邊。第一塊貼病人「右邊」鎖骨下面、胸骨右側（即係你望落去嘅左手邊）。')},
      {k:'padZ',t:'',fn:()=>cpWarn('唔啱。第一塊貼病人右邊鎖骨下面、胸骨右側。')},
      {k:'padY',t:'',fn:()=>cpWarn('唔好貼喺肚。第一塊貼病人右邊鎖骨下面。')}]); return; }
  if(s==='pads2'){
    cpSet('⑥ 貼電極片 2/2','第二塊：病人左邊胸側，喺腋下中間嗰條線、乳頭水平以下，要貼得夠側（直放）。咁電流先會斜斜穿過心臟。','貼第二塊電極片。',[]);
    cpAED({lcd:'將電極片貼喺病人赤裸嘅胸口',info:'第二塊：病人左邊胸側、腋下中間，乳頭水平以下。',pad:2,shock:()=>cpWarn('電極片未貼好，AED 未分析心律，唔可以電擊。')});
    cpHot([{k:'padB',t:'',ok:true,fn:()=>{ cpOK(); cpPad('padB'); cpHot([]); setTimeout(()=>{ if(CP.step==='pads2') cpStep('analyse'); },700); }},
      {k:'padZ',t:'',fn:()=>cpWarn('太入喇！第二塊唔係貼喺胸口前面，要貼喺左邊胸側、腋下中間嗰條線，乳頭水平以下。')},
      {k:'padX',t:'',fn:()=>cpWarn('太高喇。第二塊貼病人左邊胸側、腋下中間，乳頭水平以下。')},
      {k:'padY',t:'',fn:()=>cpWarn('唔好貼喺肚。第二塊貼病人左邊胸側、腋下中間，乳頭水平以下。')}]); return; }
  if(s==='analyse'){ cpSay('analyse'); CP.clear=false;
    cpSet('⑦ 分析心律','AED 正在分析心律。分析期間唔好接觸病人，郁動會影響分析。等佢講完。','AED 分析緊……',[
      {t:'🫸 按壓',fn:()=>{ cpSay('notouch'); cpWarn('分析心律期間唔好接觸病人！停手等 AED 分析完。'); }}]);
    cpAED({lcd:'正在分析心律，請勿接觸病人',done:1,shock:()=>cpWarn('AED 仲分析緊，未建議電擊。等佢分析完。')}); return; }
  if(s==='shock'){ cpSay('shock'); cpHelperTouch(true);
    cpSet('⑦ 電擊 1/2：叫人離開','AED 建議電擊！途人仲掂住病人。電擊前一定要大聲叫「全部人離開！」，望清楚冇人接觸病人。','AED 建議電擊。下一步？',[
      {t:'🗣️ 大聲叫：「全部人離開！」',ok:true,fn:()=>{ cpOK(); cpHelperTouch(false); cpStep('shock2'); }}]);
    cpAED({lcd:'建議電擊，請離開病人',done:1,shock:()=>cpWarn('仲有人掂住病人！電擊前要大聲叫「全部人離開」，確定冇人接觸先可以電擊。')}); return; }
  if(s==='shock2'){
    cpSet('⑦ 電擊 2/2：撳電擊掣','冇人接觸病人，撳 AED 上面閃動嘅橙色電擊掣。','撳電擊掣。',[]);
    cpAED({lcd:'按閃動嘅電擊掣',done:1,flash:true,shock:()=>{ if(CP.shocked) return; CP.shocked=1; cpShock(); }}); return; }
  if(s==='amb'){ cpMetro(false); CP.camMode='amb'; CP.amb=0;
    const st=LMK.plaza.stop, tv=CP.tv; amb.visible=true; amb.position.set(st[0]-tv[0]*60,0.12,st[1]-tv[1]*60); amb.rotation.y=Math.atan2(tv[0],tv[1]); sirenSet(true);
    cpSet('🚑 救護車到場','救護員到場喇！繼續按壓直至救護員接手。','救護員到場喇！',[]); return; }
  if(s==='end'){ cpEnd(); return; }
}
// 畫面下方嘅 AED 機（2D）：顯示屏、綠色開機掣、橙色電擊掣；貼片步驟會顯示電極片
function cpAED(o){ const A=$cp('cpAct'); const d=cpEl('div','aedui'+(o.closed?' closed':''));
  if(o.closed){ const lidv=cpEl('div','aedlid'); lidv.innerHTML='<div class="h"></div><div class="lg">♡⚡</div><b>AED</b>'; const op=cpEl('button','aedopen'+(o.powerHint?' hint':''),'⬆ 打開機蓋（自動開機）'); op.onclick=o.power; lidv.append(op);
    const sh=cpEl('button','cpb','⚡ 搵電擊掣'); sh.onclick=o.shock; d.append(lidv); A.append(d,sh); CP.aedLcd=cpEl('span'); return; }
  const face=cpEl('div','aedface'); const sp=cpEl('div','aedspk'); const sc=cpEl('img','aedscr'); sc.src=AEDT.scr.image.toDataURL();
  const vo=cpEl('div','aedvo','🔊 '+(o.lcd||'')); const rd=cpEl('i','aedrdy on');
  const ib=cpEl('button','aedi','i'); ib.onclick=()=>{ $cp('cpTxt').textContent=o.info||'跟住 AED 語音指示做。'; };
  const sh=cpEl('button','aedshk'+(o.flash?' flash':'')+(o.flash?' hint':'')); sh.innerHTML='<b>⚡</b>'; sh.onclick=()=>{ o.shock?o.shock():null; };
  face.append(vo,sp,sc,ib,rd,sh); d.append(face);
  if(o.pad){ const pr=cpEl('div','aedpads'); [1,2].forEach(n=>{ const im=cpEl('img','aedpad'+(n===o.pad?' on':'')+(n<o.pad?' used':'')); im.src=PADT[n].image.toDataURL(); pr.append(im); }); d.append(pr); }
  A.append(d); CP.aedLcd=vo; }
function cpDialUI(){ const A=$cp('cpAct'); A.innerHTML='';
  const ph=cpEl('div','cpphone'); const scr=cpEl('div','cpscr',CP.dial||'撥號'); ph.append(scr); const pad=cpEl('div','cppad');
  ['1','2','3','4','5','6','7','8','9','⌫','0','📞'].forEach(k=>{ const b=cpEl('button','cpk'+(k==='📞'?' call':''),k); if(CP.mode==='teach'&&(k==='9'||k==='📞')) b.classList.add('hint');
    b.onclick=()=>{ if(CP.called) return; if(k==='⌫') CP.dial=CP.dial.slice(0,-1); else if(k==='📞'){ if(CP.dial==='999'){ CP.called=true; cpOK(); CP.note='📞 已經打 999 叫咗救護車。'; setTimeout(()=>{ if(CP.step==='call') cpStep('askAED'); },600); } else cpWarn(CP.dial===''?'要先撥號：香港緊急求助電話係 999。':'撥錯號碼喇！香港緊急求助電話係 999。'); CP.dial=CP.called?'999 通話中':''; }
      else if(CP.dial.length<6) CP.dial+=k; scr.textContent=CP.dial||'撥號'; cpBeep(700+(+k||0)*30,0.06,0.05); }; pad.append(b); });
  ph.append(pad); A.append(ph);
  const wait=cpEl('button','cpb','⏳ 等佢自己醒'); wait.onclick=()=>cpWarn('人事不省唔會自己醒！要即刻打 999，同埋叫人攞 AED。每遲一分鐘，存活機會跌 7 至 10%。'); A.append(wait); }
function cpPress(){ const now=performance.now()/1000; if(CP.step!=='comp') return; CP.comp++; CP.taps.push(now); if(CP.taps.length>7) CP.taps.shift(); CP.jolt=1; cpBeep(220,0.05,0.04); vib(15);
  cpGauge(); const r=cpRate();
  if(r&&CP.comp>=6){ const msg=r<100?'太慢喇，要快啲（每分鐘 100 至 120 下）':r>120?'太快喇，慢少少（每分鐘 100 至 120 下），等胸口完全彈返':'';
    if(CP.mode==='teach'){ $cp('cpTxt').textContent=msg||'節奏啱啱好！保持每分鐘 100 至 120 下，雙手伸直。'; }
    else if(msg&&CP.comp>=10&&!CP.rateWarned){ CP.rateWarned=true; cpWarn(msg); } }
  if(CP.comp>=30){ cpMetro(false); setTimeout(()=>{ if(CP.step!=='comp') return; if(CP.breaths) cpStep('rescue'); else cpAfterSet(); },350); } }
function cpRate(){ const T=CP.taps; if(T.length<4) return 0; const d=(T[T.length-1]-T[0])/(T.length-1); return d>0?60/d:0; }
function cpGauge(){ const r=Math.round(cpRate()); $cp('cpRate').textContent=r||'--'; $cp('cpCnt').textContent=CP.comp+' / 30';
  const b=$cp('cpBar'); const f=Math.max(0,Math.min(1,(r-60)/100)); b.style.width=(f*100)+'%'; b.style.background=r>=100&&r<=120?'#2fb36d':r?'#ff9f1c':'#ccc'; }
function cpAfterSet(){ CP.set++; if(CP.set===1) cpStep('aedArrive'); else cpStep('amb'); }
function cpPad(key){ const n=key==='padA'?1:2; const Q=PADPOSE[key], vp=CP.m.vp;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(0.15,0.2),new THREE.MeshStandardMaterial({map:PADT[n],roughness:0.75,polygonOffset:true,polygonOffsetFactor:-2,side:THREE.DoubleSide}));
  m.position.set(...Q.p); m.rotation.set(0,Q.ry,Q.rz); vp.add(m); CP.m.pads.push(m);
  // 電線：由 AED 插頭拉去電極片頂
  const P=new THREE.Vector3(Q.p[0],Q.p[1]+0.1,Q.p[2]); vp.localToWorld(P); const A=CP.m.aed, pt=new THREE.Vector3(); A.userData.port.getWorldPosition(pt);
  const mid=pt.clone().lerp(P,0.5); mid.y=0.16; const curve=new THREE.CatmullRomCurve3([pt,new THREE.Vector3(pt.x,0.14,pt.z).lerp(mid,0.35),mid,P]);
  const w=new THREE.Mesh(new THREE.TubeGeometry(curve,28,0.014,6,false),M(n===1?0x8fb7ef:0xe9edf2,{r:0.5})); scene.add(w); CP.m.pads.push(w);
}
function raiseArm(pp,i,on){ const a=pp.userData.arms[i]; if(a.userData.y0===undefined){ a.userData.y0=a.position.y; a.userData.x0=a.position.x; }   // 舉高隻手：手臂移到膊頭上面、垂直向上
  if(on){ a.position.y=a.userData.y0+1.25; a.position.x=a.userData.x0*1.4; a.rotation.set(0,0,(a.userData.x0>0?-1:1)*0.22); } else { a.position.y=a.userData.y0; a.position.x=a.userData.x0; a.rotation.z=0; } }
function cpHelperTouch(on){ const K=cpKneelSpots(), hp=CP.m.hp; if(on){ cpPlace(hp,K.hp[0],K.hp[1],Math.atan2(-CP.u[0],-CP.u[1]),true); raiseArm(hp,1,false); hp.userData.arms.forEach(a=>a.rotation.x=-1.4); }
  else { cpPlace(hp,K.hp[0]+CP.u[0]*1.3,K.hp[1]+CP.u[1]*1.3,Math.atan2(-CP.u[0],-CP.u[1]),false); hp.userData.arms[0].rotation.x=-0.3; raiseArm(hp,1,true); } }   // 退後、舉手示意其他人唔好埋嚟
function cpShock(){ cpHot([]); $cp('cpAct').innerHTML=''; CP.jolt=2.2; cpBeep(160,0.5,0.15); const f=$cp('cpWarn'); document.body.classList.add('cpflash'); setTimeout(()=>document.body.classList.remove('cpflash'),180);
  setTimeout(()=>{ cpSay('done');  },500); setTimeout(()=>{ if(CP.step==='shock2'){ raiseArm(CP.m.me,0,false); raiseArm(CP.m.hp,1,false); cpStep('comp'); } },2600); }
function cpEnd(){ cpMetro(false); sirenSet(false); const w=$cp('cp'); w.style.display='none'; cpHot([]);
  $('rTitle').textContent=CP.mode==='teach'?'教學完成':'練習完成'; $('rStars').textContent=''; $('rTime').textContent='救護員已經接手';
  $('rNote').textContent=CP.warn.length?('今次有 '+CP.warn.length+' 個地方要留意：'):'全部步驟正確，做得好！記住：冷靜 → 檢查 → 召喚 → CPR + AED。';
  const ul=$('rTips'); ul.innerHTML=''; (CP.warn.length?CP.warn:['冷靜：確定現場環境安全','檢查：輕拍膊頭、大聲叫，確定人事不省','召喚：指定途人打 999、攞 AED，搵唔搵到都返嚟','CPR：每分鐘 100–120 下，壓 5–6 公分，完全回彈','AED：開機 → 貼電極片 → 分析及電擊，分析同電擊時唔好掂病人']).forEach(x=>{ const li=document.createElement('li'); li.textContent=x; ul.append(li); });
  $('rAch').innerHTML=''; $('rNext').style.display='none'; $('rName').style.display='none'; $('rSave').style.display='none'; show('result',true); show('hudWrap',false); S.mode='result'; }

/* ---------- 每格更新 ---------- */
function cprTick(dt,t){ if(!CP.on) return; CP.t+=dt; const me=CP.m.me, vp=CP.m.vp, V=CP.V, tv=CP.tv;
  if(CP.step==='walk'){ // 行近；第 2.2 秒佢暈低
    const tx=V[0]+tv[0]*9, tz=V[1]+tv[1]*9; const dx=tx-me.position.x, dz=tz-me.position.z, d=Math.hypot(dx,dz);
    if(d>0.2){ me.position.x+=dx/d*Math.min(d,2.6*dt); me.position.z+=dz/d*Math.min(d,2.6*dt); const w=Math.sin(t*9)*0.5; me.userData.legL.rotation.x=w; me.userData.legR.rotation.x=-w; }
    else { me.userData.legL.rotation.x=me.userData.legR.rotation.x=0; }
    if(CP.t>2.2&&vp.userData.stand){ vp.userData.fall=(vp.userData.fall||0)+dt*2.2; const f=Math.min(1,vp.userData.fall); vp.rotation.x=-Math.PI/2*f*f; vp.position.y=MKY*MK*f;
      if(f>=1){ cpLay(); cpBeep(140,0.25,0.12); CP.calmAt=CP.t+0.8; } }
    if(!vp.userData.stand&&CP.calmAt&&CP.t>CP.calmAt){ CP.calmAt=0; cpStep('calm'); } }
  if(CP.camMode==='scan'){ CP.scanA+=dt*2.6; if(CP.scanA>=Math.PI*2){ CP.camMode='go'; } }
  if(CP.camMode==='go'){ // 行埋去跪低
    const K=cpKneelSpots(); const dx=K.me[0]-me.position.x, dz=K.me[1]-me.position.z, d=Math.hypot(dx,dz);
    if(d>0.25){ me.position.x+=dx/d*Math.min(d,4*dt); me.position.z+=dz/d*Math.min(d,4*dt); me.rotation.y=Math.atan2(dx,dz); const w=Math.sin(t*11)*0.6; me.userData.legL.rotation.x=w; me.userData.legR.rotation.x=-w; }
    else { cpPlace(me,K.me[0],K.me[1],Math.atan2(CP.u[0],CP.u[1]),true); me.userData.arms.forEach(a=>a.rotation.x=-1.2); cpStep('check'); } }
  // 途人跑去攞 AED
  if(CP.helperRun&&CP.step!=='aedArrive'&&CP.set===0){ const hp=CP.m.hp; const away=[V[0]-tv[0]*40,V[1]-tv[1]*40]; const dx=away[0]-hp.position.x, dz=away[1]-hp.position.z, d=Math.hypot(dx,dz);
    if(d>0.5){ hp.position.x+=dx/d*6*dt; hp.position.z+=dz/d*6*dt; hp.rotation.y=Math.atan2(dx,dz); hp.userData.arms[1].rotation.x=-2.7; const w=Math.sin(t*13)*0.7; hp.userData.legL.rotation.x=w; hp.userData.legR.rotation.x=-w; } else hp.visible=false; }
  if(CP.step==='aedArrive') CP.m.hp.visible=true;
  if(CP.step==='call'&&CP.m.hp.visible){ const hp=CP.m.hp; hp.rotation.y=Math.atan2(me.position.x-hp.position.x,me.position.z-hp.position.z); }
  if(CP.step==='breath') CP.brT+=dt;
  if(CP.bubT>0){ CP.bubT-=dt; const b=$cp('cpBub'); const H=CP.m.hp.position, v=new THREE.Vector3(H.x,3.6,H.z).project(cam); b.style.left=((v.x+1)/2*innerWidth)+'px'; b.style.top=((1-v.y)/2*innerHeight)+'px'; if(CP.bubT<=0) b.style.display='none'; }
  { const A=CP.m.aed; if(A&&A.visible){ if(CP.aedOn&&CP.aedLid<1){ CP.aedLid=Math.min(1,CP.aedLid+dt*2.2); aedOpen(A,CP.aedLid); }
    A.userData.led.material.color.setHex(CP.aedOn?0x33ff66:0x1d3a24); A.userData.shk.material.color.setHex(CP.step==='shock2'&&!CP.shocked&&Math.floor(t*4)%2?0xffd060:0xb4560a); } }
  if(CP.step==='analyse'&&CP.t>4.6){ cpStep('shock'); }
  // 按壓動畫
  if(CP.jolt>0){ CP.jolt=Math.max(0,CP.jolt-dt*7); }
  else if(CP.jolt<0){ CP.jolt=Math.min(0,CP.jolt+dt*2); }
  const press=CP.step==='comp'?Math.max(0,CP.jolt):0;
  if(CP.step==='analyse'||CP.step==='shock'||CP.step==='shock2'){ const K=cpKneelSpots(), u=CP.u, clr=CP.step==='shock2';
    me.position.x=K.me[0]-u[0]*0.9; me.position.z=K.me[1]-u[1]*0.9; raiseArm(me,0,clr); if(!clr) me.userData.arms[0].rotation.x=-0.2; me.userData.arms[1].rotation.x=-0.2; }   // 分析同電擊：雙手離開病人；叫完離開就退後舉手
  else if(CP.step==='pads'||CP.step==='pads2'||CP.step==='strip'){ const K=cpKneelSpots(); me.position.x=K.me[0]; me.position.z=K.me[1]; me.userData.arms.forEach(a=>a.rotation.x=-1.2); }
  const handsOn=CP.step==='comp'||CP.step==='amb'; me.visible=!handsOn; const HN=CP.m.hands;
  if(HN){ HN.visible=handsOn; if(handsOn){ const C=cpW(0,1.86,0.15+0.02); const f=cpW(0,1.86,0.15).sub(cpW(0,1.86,0)).normalize();
    HN.position.set(C.x,C.y-press*0.06,C.z); HN.rotation.y=Math.atan2(CP.u[0],CP.u[1]); /* 手指橫跨胸口、手臂向救人者嗰邊 */ } }
  const tor=vp.userData.torso; if(tor) tor.scale.z=1-press*0.2;
  if(CP.step==='shock2'||CP.jolt>1.2){ if(CP.jolt>1){ vp.position.y=MKY*MK+Math.sin(t*60)*0.06*(CP.jolt-1); } else if(!vp.userData.stand) vp.position.y=MKY*MK; }
  if(CP.step==='amb'){ CP.amb+=dt; const st=LMK.plaza.stop; const tx=st[0]-tv[0]*6, tz=st[1]-tv[1]*6; const dx=tx-amb.position.x, dz=tz-amb.position.z, d=Math.hypot(dx,dz);
    if(d>0.3){ const v=Math.min(14,d*1.4); amb.position.x+=dx/d*v*dt; amb.position.z+=dz/d*v*dt; }
    // 救護車到之前繼續按（自動節奏）
    if(Math.floor(CP.amb*1.83)!==Math.floor((CP.amb-dt)*1.83)) CP.jolt=1;
    if(CP.amb>6.5) cpStep('end'); }
  // 熱點跟住 3D 位置
  if(CP.hot.length){ const v=new THREE.Vector3(); CP.hot.forEach(({b,h})=>{ const P=cpW(...CPPT[h.k]); v.copy(P).project(cam); b.style.left=((v.x+1)/2*innerWidth)+'px'; b.style.top=((1-v.y)/2*innerHeight)+'px'; }); }
}
function cprCam(dt,t){ const V=CP.V, u=CP.u, tv=CP.tv, me=CP.m.me; if(!V) return; const portrait=innerWidth<innerHeight; let P,Lk;
  // 下面有說明卡：將畫面中心向上移，主角唔會俾卡遮住
  const off=Math.round(innerHeight*(portrait?0.24:0.16)), vk=off+'x'+innerWidth; if(CP.vo!==vk){ CP.vo=vk; cam.setViewOffset(innerWidth,innerHeight,0,off,innerWidth,innerHeight); }
  const C=cpW(...CPPT.chMid);
  if(CP.camMode==='walk'||CP.camMode==='look'){ const fx=V[0]-me.position.x, fz=V[1]-me.position.z, d=Math.hypot(fx,fz)||1;
    P=new THREE.Vector3(me.position.x-fx/d*6-u[0]*2.5,6.5,me.position.z-fz/d*6-u[1]*2.5); Lk=new THREE.Vector3(V[0],0.8,V[1]); }
  else if(CP.camMode==='kneel'&&CP.step==='shock2'){ P=new THREE.Vector3(C.x-tv[0]*10.5,4.6,C.z-tv[1]*10.5); Lk=new THREE.Vector3(C.x+tv[0]*0.6,1.9,C.z+tv[1]*0.6); }   // 電擊：低角度拉闊，見到所有人退後舉手
  else if(CP.camMode==='scan'){ const a=CP.scan0+CP.scanA; P=new THREE.Vector3(V[0]+Math.sin(a)*9,10,V[1]+Math.cos(a)*9); Lk=new THREE.Vector3(V[0],0.6,V[1]); }   // 高啲睇落嚟，唔俾樹遮
  else if(CP.camMode==='helper'){ const H=CP.m.hp.position, mp=me.position; const dx=H.x-mp.x, dz=H.z-mp.z, d=Math.hypot(dx,dz)||1;
    P=new THREE.Vector3(mp.x-dx/d*2.5,5.5,mp.z-dz/d*2.5); Lk=new THREE.Vector3(H.x,1.4,H.z); }   // 轉去望住途人
  else if(CP.camMode==='go'){ P=new THREE.Vector3(C.x-tv[0]*3.5,9.5,C.z-tv[1]*3.5); Lk=new THREE.Vector3(C.x,0.5,C.z); }   // 由上面跟住行埋去，唔俾樹遮
  else if(CP.camMode==='amb'){ P=new THREE.Vector3(C.x-u[0]*11-tv[0]*6,13,C.z-u[1]*11-tv[1]*6); Lk=new THREE.Vector3(C.x-u[0]*4+tv[0]*2,0.8,C.z-u[1]*4+tv[1]*2); }
  else { const k=(portrait?1.12:1)*1, pl=cpW(1,1.86,0).sub(cpW(0,1.86,0)).setY(0).normalize(); P=new THREE.Vector3(C.x-tv[0]*1.5*k+pl.x*1.5,4.3*k,C.z-tv[1]*1.5*k+pl.z*1.5); Lk=new THREE.Vector3(C.x+tv[0]*0.45,0.2,C.z+tv[1]*0.45); }   // 差唔多正上方睇落胸口，頭喺上面   // 由腳嗰邊斜斜睇落去，救護員喺側邊唔會遮住
  { const D=S.camDrag; if(D&&(D.yaw||D.pitch)){ const v=P.clone().sub(Lk), c=Math.cos(D.yaw), sn=Math.sin(D.yaw); const x=v.x*c+v.z*sn, z=-v.x*sn+v.z*c; v.x=x; v.z=z;   // 拉畫面：圍住目標轉
    const hz=Math.hypot(v.x,v.z), L=v.length(); const el=Math.max(0.15,Math.min(1.45,Math.atan2(v.y,hz)+D.pitch*0.8)); v.y=Math.sin(el)*L; const k=Math.cos(el)*L/(hz||1); v.x*=k; v.z*=k; P=Lk.clone().add(v); } }
  if(CP.snap){ CP.snap=false; cam.position.copy(P); camLook.copy(Lk); return; }
  cam.position.lerp(P,Math.min(1,dt*(CP.camMode==='scan'?10:3.5))); camLook.lerp(Lk,Math.min(1,dt*4)); }
// 電腦：空白鍵按壓
addEventListener('keydown',e=>{ if(CP.on&&CP.step==='comp'&&(e.code==='Space'||e.key===' ')){ e.preventDefault(); if(!e.repeat) cpPress(); } });
window.__CP=CP; window.__cpStep=cpStep; window.__startCPR=startCPR;

/* ---------- 城市動物：行人路上嘅貓、狗、白鴿、麻雀（郊區有黃牛）、河／湖上嘅鴨仔、天上嘅麻鷹同飛機 ----------
   慳效能：每隻動物大部分砌埋做一個網格（vertex color），用完放返入池；離開視野就自己收返。 */
const ANI_DEF={on:true,ground:8,ducks:3,plane:true,kite:true,types:{cat:true,dog:true,pigeon:true,sparrow:true,cow:true}};
const ANI=(()=>{
  let CFG=(()=>{ const v=store.get('ani',null)||{}; if(!store.get('aniV2',false)){ if(v.ground===4) v.ground=8; if(v.ducks===2) v.ducks=3; store.set('aniV2',true); } return Object.assign({},ANI_DEF,v,{types:Object.assign({},ANI_DEF.types,v.types||{})}); })();
  const MAT=new THREE.MeshLambertMaterial({vertexColors:true}), MATNF=new THREE.MeshLambertMaterial({vertexColors:true}); MATNF.fog=false;
  const BX=new THREE.BoxGeometry(1,1,1), SP=new THREE.SphereGeometry(1,8,6), CN=new THREE.ConeGeometry(1,1,5), CY=new THREE.CylinderGeometry(1,1,1,8);
  const _m=new THREE.Matrix4(), _q=new THREE.Quaternion(), _e=new THREE.Euler(), _c=new THREE.Color(), _p=new THREE.Vector3(), _s=new THREE.Vector3();
  // parts: [geo, 顏色, [x,y,z], [sx,sy,sz], [rx,ry,rz]]
  function merge(parts){ const pos=[],nor=[],col=[];
    for(const [geo,hex,p,s,r] of parts){ const g=geo.index?geo.toNonIndexed():geo.clone(); _e.set(...(r||[0,0,0])); _q.setFromEuler(_e); _m.compose(_p.set(...p),_q,_s.set(...s)); g.applyMatrix4(_m); _c.setHex(hex);
      const P=g.attributes.position, N=g.attributes.normal; for(let i=0;i<P.count;i++){ pos.push(P.getX(i),P.getY(i),P.getZ(i)); nor.push(N.getX(i),N.getY(i),N.getZ(i)); col.push(_c.r,_c.g,_c.b); } g.dispose(); }
    const G=new THREE.BufferGeometry(); G.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); G.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3)); G.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); G.computeBoundingSphere(); return G; }
  const GC={}; const geo=(k,f)=>GC[k]||(GC[k]=f());
  const mesh=(G,mat=MAT)=>{ const m=new THREE.Mesh(G,mat); m.matrixAutoUpdate=true; return m; };
  // 腳：頂部做轉軸
  const legGeo=(k,w,h,d,hex)=>geo(k,()=>merge([[BX,hex,[-w/2,-h/2,0],[w*0.4,h,d]],[BX,hex,[w/2,-h/2,0],[w*0.4,h,d]],[BX,hex,[-w/2,-h+0.03,0.03],[w*0.42,0.06,d*1.3]],[BX,hex,[w/2,-h+0.03,0.03],[w*0.42,0.06,d*1.3]]]));   // 兩隻腳＋腳掌，頂部係轉軸

  /* ----- 模型 ----- */
  const CATC=[[0xe8963c,0xf6d2a2],[0x2b2b30,0x2b2b30],[0xd9d6cf,0x8a8580],[0x8a6a50,0xe6d6c0]];
  function cat(v){ const [a,b]=CATC[v], g=new THREE.Group();
    g.add(mesh(geo('cat'+v,()=>merge([[BX,a,[0,0.5,0],[0.38,0.34,0.85]],[BX,b,[0,0.42,0.12],[0.3,0.12,0.5]],[SP,a,[0,0.78,0.5],[0.25,0.23,0.24]],[SP,b,[0,0.72,0.68],[0.1,0.08,0.08]],
      [CN,a,[-0.12,1.0,0.48],[0.08,0.16,0.08]],[CN,a,[0.12,1.0,0.48],[0.08,0.16,0.08]],[SP,0x3b8f3b,[-0.09,0.82,0.72],[0.04,0.05,0.03]],[SP,0x3b8f3b,[0.09,0.82,0.72],[0.04,0.05,0.03]],
      [BX,a,[0,0.8,-0.56],[0.08,0.08,0.58],[0.95,0,0]]]))));
    const lF=mesh(legGeo('catL'+v,0.3,0.4,0.1,a)), lB=mesh(legGeo('catL'+v,0.3,0.4,0.1,a)); lF.position.set(0,0.4,0.3); lB.position.set(0,0.4,-0.3); g.add(lF,lB); g.userData={lF,lB,h:1}; return g; }
  const DOGC=[[0xb9824a,0xe9cfa6],[0xe9dcc0,0xcbb894],[0x3a3330,0xb9824a]];
  function dog(v){ const [a,b]=DOGC[v], g=new THREE.Group();
    g.add(mesh(geo('dog'+v,()=>merge([[BX,a,[0,0.72,0],[0.5,0.45,1.15]],[BX,b,[0,0.6,0.15],[0.42,0.2,0.7]],[BX,a,[0,1.08,0.72],[0.42,0.4,0.46]],[BX,b,[0,0.98,1.02],[0.24,0.2,0.26]],[SP,0x1a1a1a,[0,1.04,1.16],[0.06,0.05,0.04]],
      [BX,a,[-0.17,1.33,0.66],[0.1,0.22,0.1],[0,0,0.25]],[BX,a,[0.17,1.33,0.66],[0.1,0.22,0.1],[0,0,-0.25]],[BX,a,[0,0.98,-0.74],[0.09,0.09,0.5],[0.75,0,0]]]))));
    const lF=mesh(legGeo('dogL'+v,0.4,0.6,0.14,a)), lB=mesh(legGeo('dogL'+v,0.4,0.6,0.14,a)); lF.position.set(0,0.6,0.4); lB.position.set(0,0.6,-0.4); g.add(lF,lB); g.userData={lF,lB,h:1}; return g; }
  function cow(){ const a=0xb27a3e, g=new THREE.Group();
    g.add(mesh(geo('cow',()=>merge([[BX,a,[0,1.3,0],[0.9,0.8,1.8]],[BX,a,[0,1.6,1.15],[0.5,0.5,0.62]],[BX,0x3a2a20,[0,1.5,1.48],[0.4,0.26,0.1]],[CN,0xe8e0cc,[-0.3,1.95,1.1],[0.06,0.3,0.06],[0,0,0.9]],[CN,0xe8e0cc,[0.3,1.95,1.1],[0.06,0.3,0.06],[0,0,-0.9]],
      [BX,a,[0,1.28,-0.93],[0.07,0.8,0.07],[0.15,0,0]],[BX,0x3a2a20,[0,0.86,-0.99],[0.12,0.16,0.12]],[BX,0xc79a62,[0,0.95,0],[0.7,0.1,1.2]]]))));
    const lF=mesh(legGeo('cowL',0.7,0.92,0.22,a)), lB=mesh(legGeo('cowL',0.7,0.92,0.22,a)); lF.position.set(0,0.92,0.65); lB.position.set(0,0.92,-0.65); g.add(lF,lB); g.userData={lF,lB,h:1}; return g; }
  // 雀：身＋頭＋嘴砌埋；翼另外一塊（飛先見到）
  const BIRD={pigeon:[0x8d94a3,0x5d6878,0x6a7a8c,1.6],sparrow:[0x8a6a48,0x5a3f2a,0xb79a78,1.0]};
  function bird(k){ const [a,h,w,sc]=BIRD[k], b=new THREE.Group();
    b.add(mesh(geo('b'+k,()=>merge([[SP,a,[0,0.2,0],[0.16,0.15,0.24]],[SP,h,[0,0.36,0.17],[0.1,0.1,0.1]],[CN,0xd9a441,[0,0.35,0.29],[0.035,0.1,0.035],[Math.PI/2,0,0]],[BX,h,[0,0.24,-0.26],[0.12,0.03,0.16]]]))));
    const wing=mesh(geo('bw'+k,()=>merge([[BX,w,[-0.22,0.27,0],[0.36,0.02,0.18]],[BX,w,[0.22,0.27,0],[0.36,0.02,0.18]]]))); wing.visible=false; b.add(wing); b.userData={wing}; b.scale.setScalar(sc); return b; }
  function flock(k,n){ const g=new THREE.Group(), bs=[]; for(let i=0;i<n;i++){ const b=bird(k); g.add(b); bs.push(b); } g.userData={bs,h:1}; return g; }
  function duck(young){ return mesh(geo(young?'dkY':'dk',()=>young?merge([[SP,0xffd84a,[0,0.12,0],[0.17,0.13,0.24]],[SP,0xffd84a,[0,0.27,0.16],[0.1,0.1,0.1]],[BX,0xf08a24,[0,0.26,0.28],[0.07,0.03,0.08]]])
      :merge([[SP,0x8a6a4a,[0,0.15,0],[0.3,0.22,0.45]],[SP,0xe9e2d0,[0,0.1,0.05],[0.27,0.12,0.38]],[SP,0x1f6b3a,[0,0.44,0.3],[0.16,0.16,0.16]],[BX,0xf2f2f2,[0,0.3,0.3],[0.2,0.04,0.12]],[BX,0xf0a020,[0,0.41,0.5],[0.12,0.05,0.16]],[BX,0x3a3a3a,[0,0.24,-0.42],[0.14,0.06,0.14],[0.5,0,0]]]))); }
  function family(){ const g=new THREE.Group(), ds=[duck(false)]; const n=2+(Math.random()*3|0); for(let i=0;i<n;i++) ds.push(duck(true)); ds.forEach((d,i)=>{ d.position.set((i%2?0.35:-0.35)*(i>0),0,-i*0.9); g.add(d); }); g.userData={ds,h:1}; return g; }
  function plane(){ const g=new THREE.Group(), W=0xf4f6f8, B=0x1f5fa8;
    g.add(mesh(geo('plane',()=>merge([[CY,W,[0,0,0],[1.6,16,1.6],[Math.PI/2,0,0]],[SP,W,[0,0,8],[1.6,1.6,2.6]],[CN,W,[0,0.3,-10],[1.6,4,1.6],[-Math.PI/2,0,0]],
      [BX,0xdfe3e8,[-5.6,-0.5,0],[11.5,0.35,3.2],[0,-0.38,0]],[BX,0xdfe3e8,[5.6,-0.5,0],[11.5,0.35,3.2],[0,0.38,0]],[BX,0xdfe3e8,[-2.2,0.4,-10],[4.4,0.3,1.6],[0,-0.45,0]],[BX,0xdfe3e8,[2.2,0.4,-10],[4.4,0.3,1.6],[0,0.45,0]],[BX,B,[0,2.6,-10],[0.3,4.2,2.8]],[BX,B,[0,-0.2,0],[1.62,0.35,16.2]],
      [CY,0xb8bec6,[-5,-1.4,2.2],[0.7,2.6,0.7],[Math.PI/2,0,0]],[CY,0xb8bec6,[5,-1.4,2.2],[0.7,2.6,0.7],[Math.PI/2,0,0]],[BX,0x27313d,[0,0.55,7.4],[1.5,0.5,1.4]]]),MATNF)));
    const lit=mesh(geo('planeL',()=>merge([[SP,0xff3030,[10.8,-0.5,-2],[0.35,0.35,0.35]],[SP,0x30ff60,[-10.8,-0.5,-2],[0.35,0.35,0.35]]])),new THREE.MeshBasicMaterial({vertexColors:true,fog:false})); g.add(lit);
    const strobe=mesh(SP,new THREE.MeshBasicMaterial({color:0xffffff,fog:false})); strobe.scale.setScalar(0.45); strobe.position.set(0,-1.7,0); g.add(strobe); g.userData={strobe,h:1}; g.scale.setScalar(1.3); return g; }
  function kite(){ const g=new THREE.Group(), a=0x4a3a2c;
    g.add(mesh(geo('kite',()=>merge([[SP,a,[0,0,0],[0.25,0.2,0.75]],[SP,0x6b5640,[0,0.05,0.62],[0.15,0.15,0.17]],[BX,0x3a2c20,[0,0,-0.85],[0.55,0.05,0.5]],[BX,a,[-1.1,0.18,0.05],[2.0,0.06,0.62],[0,0,0.15]],[BX,a,[1.1,0.18,0.05],[2.0,0.06,0.62],[0,0,-0.15]],[BX,0x2a1f16,[-1.9,0.3,0.05],[0.5,0.07,0.5],[0,0,0.15]],[BX,0x2a1f16,[1.9,0.3,0.05],[0.5,0.07,0.5],[0,0,-0.15]]]))));
    g.scale.setScalar(1.5); g.userData={h:1}; return g; }

  // 遊隼：細隻、尖翼向後掃、灰藍背、淺色胸
  function falcon(){ const g=new THREE.Group(), b=0x4f5d6b;
    const body=mesh(geo('falc',()=>merge([[SP,b,[0,0,0],[0.17,0.15,0.55]],[SP,0xe9e1cf,[0,-0.05,0.12],[0.13,0.1,0.3]],[SP,0x2b3138,[0,0.04,0.5],[0.12,0.12,0.13]],[CN,0xe0a800,[0,0.02,0.64],[0.03,0.08,0.03],[Math.PI/2,0,0]],[BX,b,[0,0,-0.6],[0.22,0.04,0.42]]])));
    const wing=mesh(geo('falcW',()=>merge([[BX,b,[-0.62,0.03,-0.08],[1.15,0.04,0.34],[0,-0.42,0]],[BX,b,[0.62,0.03,-0.08],[1.15,0.04,0.34],[0,0.42,0]],[BX,0x2b3138,[-1.12,0.04,-0.32],[0.4,0.04,0.2],[0,-0.7,0]],[BX,0x2b3138,[1.12,0.04,-0.32],[0.4,0.04,0.2],[0,0.7,0]]])));
    g.add(body,wing); g.userData={wing}; g.scale.setScalar(2.4); return g; }
  /* ----- 池 ----- */
  const pools={}, live=[];
  const take=(key,mk)=>{ const p=pools[key]||(pools[key]=[]); const g=p.pop()||mk(); g.visible=true; if(!g.parent) scene.add(g); return g; };
  const free=a=>{ a.g.visible=false; (pools[a.key]||(pools[a.key]=[])).push(a.g); a.dead=true; };
  function clear(){ live.forEach(free); live.length=0; }
  const FS=new THREE.Sphere(new THREE.Vector3(),2), CD=new THREE.Vector3();
  function seen(x,y,z,r,far){ const dx=x-cam.position.x, dz=z-cam.position.z, dy=y-cam.position.y; if(dx*dx+dy*dy+dz*dz>far*far) return false; FS.center.set(x,y,z); FS.radius=r; return FR.intersectsSphere(FS); }
  const count=k=>live.reduce((n,a)=>n+(a.cls===k?1:0),0);
  const rnd2=(a,b)=>a+Math.random()*(b-a);

  /* ----- 行人路動物 ----- */
  function spawnGround(any){ cam.getWorldDirection(CD); const cx=cam.position.x, cz=cam.position.z;
    for(let tries=0;tries<60;tries++){ const r=MAP.roads[Math.random()*MAP.roads.length|0]; if(r.bridge||r.elev||r.closed) continue;
      const A=NODES[r.n[0]],B=NODES[r.n[1]], L=Math.hypot(B[0]-A[0],B[1]-A[1]); if(L<16) continue;
      const s=rnd2(5,L-5), ux=(B[0]-A[0])/L, uz=(B[1]-A[1])/L, side=Math.random()<0.5?1:-1, off=(r.w/2+1.3+Math.random()*1.2)*side;
      const x=A[0]+ux*s+uz*off, z=A[1]+uz*s-ux*off, dx=x-cx, dz=z-cz, d=Math.hypot(dx,dz);
      if(d<(any?20:80)||d>210||(!any&&(dx*CD.x+dz*CD.z)/d<0.35)) continue; if(cellAt(x,z)&1) continue;   // 前面遠少少、唔可以喺馬路上
      const rur=REGION==='tm'&&rural(x,z), W=(rur?[['cow',4],['dog',3],['sparrow',3]]:[['cat',30],['dog',22],['pigeon',33],['sparrow',15]]).filter(([k])=>CFG.types[k]);
      if(!W.length) continue; let q=Math.random()*W.reduce((n,w)=>n+w[1],0), kind=W[0][0]; for(const [k,w] of W){ if((q-=w)<0){ kind=k; break; } }
      let g, key;
      if(kind==='cat'){ const v=Math.random()*CATC.length|0; key='cat'+v; g=take(key,()=>cat(v)); }
      else if(kind==='dog'){ const v=Math.random()*DOGC.length|0; key='dog'+v; g=take(key,()=>dog(v)); }
      else if(kind==='cow'){ key='cow'; g=take(key,cow); }
      else { key=kind; g=take(key,()=>flock(kind,kind==='pigeon'?4:3)); g.userData.bs.forEach((b,i)=>{ b.position.set(rnd2(-1.2,1.2),0,rnd2(-1.2,1.2)); b.rotation.set(0,Math.random()*6.28,0); b.userData.wing.visible=false; b.userData.v=null; }); }
      const a={cls:'ground',kind,key,g,A,B,L,ux,uz,s,off,dir:Math.random()<0.5?1:-1,mode:kind==='pigeon'||kind==='sparrow'?'peck':'walk',mt:rnd2(2,6),life:0,seenT:false,gone:0,x,z,y:0,ph:Math.random()*6};
      g.position.set(x,0.15,z); g.scale.setScalar(0.01); live.push(a); return; } }
  function tickGround(a,dt,t){ const c=S.car, near=Math.hypot(a.x-c.x,a.z-c.z), fast=Math.abs(c.v)>1.5;
    const k=Math.min(1,a.life/0.6); a.g.scale.setScalar(Math.max(0.01,k)*(a.kind==='cow'?1.25:a.kind==='dog'?1.15:1.35));
    if(a.kind==='pigeon'||a.kind==='sparrow'){ const bs=a.g.userData.bs;
      if(a.mode==='peck'&&(near<(S.siren?22:13)&&fast||near<5)){ a.mode='fly'; const ax=a.x-c.x, az=a.z-c.z, n=Math.hypot(ax,az)||1; a.vx=ax/n*7; a.vz=az/n*7; bs.forEach(b=>{ b.userData.wing.visible=true; b.rotation.set(0,Math.atan2(a.vx,a.vz)+rnd2(-0.4,0.4),0); b.userData.v=rnd2(3,5); }); }
      if(a.mode==='peck'){ a.mt-=dt; bs.forEach((b,i)=>{ const hop=a.kind==='sparrow'?Math.max(0,Math.sin(t*7+i*2)): 0; b.position.y=hop*0.18; b.rotation.x=Math.max(0,Math.sin(t*(a.kind==='sparrow'?9:5)+i*1.7))*0.55;
          if(a.kind==='pigeon'){ b.position.x+=Math.sin(b.rotation.y)*0.25*dt; b.position.z+=Math.cos(b.rotation.y)*0.25*dt; if(Math.random()<dt*0.3) b.rotation.y+=rnd2(-1,1); } }); }
      else { a.x+=a.vx*dt; a.z+=a.vz*dt; bs.forEach((b,i)=>{ b.position.y+=b.userData.v*dt; b.rotation.x=-0.25; const w=b.userData.wing; w.scale.x=0.35+0.65*Math.abs(Math.sin(t*22+i)); }); a.y=bs[0].position.y; }
      a.g.position.set(a.x,0.15,a.z); return; }
    // 貓狗牛：沿行人路行，有時停低；救護車衝埋嚟就走開
    const U=a.g.userData; let sp=a.kind==='cat'?0.9:a.kind==='dog'?1.4:0.5;
    if(a.mode!=='flee'&&near<(S.siren?18:10)&&fast&&a.kind!=='cow'){ a.mode='flee'; a.mt=1.6; const ahead=(a.x-c.x)*a.ux+(a.z-c.z)*a.uz; a.dir=ahead>=0?1:-1; }
    a.mt-=dt;
    if(a.mode==='flee'){ sp=a.kind==='cat'?6:5; if(a.mt<0){ a.mode='walk'; a.mt=rnd2(3,7); } }
    else if(a.mode==='walk'&&a.mt<0){ a.mode='rest'; a.mt=rnd2(2,5); }
    else if(a.mode==='rest'&&a.mt<0){ a.mode='walk'; a.mt=rnd2(3,8); if(Math.random()<0.4) a.dir*=-1; }
    const moving=a.mode!=='rest';
    if(moving){ a.s+=a.dir*sp*dt; if(a.s<3||a.s>a.L-3){ a.dir*=-1; a.s=Math.max(3,Math.min(a.L-3,a.s)); } }
    a.x=a.A[0]+a.ux*a.s+a.uz*a.off; a.z=a.A[1]+a.uz*a.s-a.ux*a.off;
    const sw=moving?Math.sin(t*(sp>3?18:8)+a.ph)*(sp>3?0.8:0.5):0; U.lF.rotation.x=sw; U.lB.rotation.x=-sw;
    a.g.position.set(a.x,0.15,a.z); const ya=Math.atan2(a.ux*a.dir,a.uz*a.dir); a.g.rotation.y=a.mode==='rest'?ya+Math.sin(t*0.7+a.ph)*0.5:ya; }

  /* ----- 鴨仔：沿城門河／屯門河／湖慢慢游 ----- */
  const RC=[0]; for(let i=1;i<RIV.length;i++) RC.push(RC[i-1]+Math.hypot(RIV[i][0]-RIV[i-1][0],RIV[i][1]-RIV[i-1][1])); const RLEN=RC[RC.length-1];
  function rivAt(s){ s=Math.max(0,Math.min(RLEN,s)); let i=1; while(i<RC.length-1&&RC[i]<s) i++; const A=RIV[i-1],B=RIV[i], L=RC[i]-RC[i-1]||1, f=(s-RC[i-1])/L; return [A[0]+(B[0]-A[0])*f,A[1]+(B[1]-A[1])*f,(B[0]-A[0])/L,(B[1]-A[1])/L]; }
  const LC=(()=>{ let x=0,z=0; LAKE.forEach(p=>{x+=p[0];z+=p[1];}); x/=LAKE.length; z/=LAKE.length; let r=1e9; LAKE.forEach(p=>r=Math.min(r,Math.hypot(p[0]-x,p[1]-z))); return [x,z,r]; })();
  function spawnDucks(any){ const cx=cam.position.x, cz=cam.position.z; cam.getWorldDirection(CD);
    const okd=(x,z)=>{ const dx=x-cx, dz=z-cz, d=Math.hypot(dx,dz); return d>(any?20:60)&&d<(any?2000:230)&&(any||(dx*CD.x+dz*CD.z)/d>0.2); };
    if(LC[2]>6&&okd(LC[0],LC[1])&&Math.random()<0.5){ const g=take('ducks',family); live.push({cls:'duck',key:'ducks',g,lake:true,ang:Math.random()*6.28,rad:LC[2]*0.55,dir:Math.random()<0.5?1:-1,life:0,seenT:false,gone:0}); return; }
    for(let tries=0;tries<40;tries++){ const s=Math.random()*RLEN, P=rivAt(s), lat=rnd2(-1,1)*(RIVH-RIVH*0.45-1.5); const x=P[0]+P[3]*lat, z=P[1]-P[2]*lat; if(!okd(x,z)) continue;
      const g=take('ducks',family); live.push({cls:'duck',key:'ducks',g,s,lat,dir:Math.random()<0.5?1:-1,life:0,seenT:false,gone:0}); return; } }
  function tickDuck(a,dt,t){ const g=a.g; let x,z,ya;
    if(a.lake){ a.ang+=a.dir*dt*0.9/a.rad; x=LC[0]+Math.cos(a.ang)*a.rad; z=LC[1]+Math.sin(a.ang)*a.rad; ya=Math.atan2(-Math.sin(a.ang)*a.dir,Math.cos(a.ang)*a.dir); }
    else { a.s+=a.dir*0.9*dt; if(a.s<5||a.s>RLEN-5) a.dir*=-1; const P=rivAt(a.s); x=P[0]+P[3]*a.lat; z=P[1]-P[2]*a.lat; ya=Math.atan2(P[2]*a.dir,P[3]*a.dir); }
    a.x=x; a.z=z; a.y=0; g.position.set(x,0.22,z); g.rotation.y=ya; g.scale.setScalar(Math.max(0.01,Math.min(1,a.life/0.8))*1.3);
    g.userData.ds.forEach((d,i)=>{ d.position.y=Math.sin(t*3+i)*0.04; d.rotation.y=Math.sin(t*1.3+i*0.8)*0.25; }); }

  /* ----- 飛機同麻鷹 ----- */
  // 鏡頭前方（水平）方向
  // 鏡頭畫面某個高度（NDC y）喺前方 d 米水平距離嘅世界高度：保證生成時喺畫面入面
  const _u=new THREE.Vector3(); function skyY(d,ny){ _u.set(0,ny,0.5).unproject(cam).sub(cam.position).normalize(); const h=Math.hypot(_u.x,_u.z)||1e-3; return cam.position.y+_u.y*d/h; }
  const halfW=d=>Math.tan(THREE.MathUtils.degToRad(cam.fov/2))*cam.aspect*d;
  const fwd=()=>{ cam.getWorldDirection(CD); const l=Math.hypot(CD.x,CD.z)||1; return [CD.x/l,CD.z/l]; };
  function spawnPlane(hw){ const g=take('plane',plane);
    if(hw){ // 高速公路：喺前方 200–260 米橫過，3 秒內入鏡
      const [fx,fz]=fwd(), d=rnd2(200,260), sd=Math.random()<0.5?1:-1, th=Math.atan2(fz,fx)+sd*(Math.PI/2+rnd2(-0.5,0.3)), ux=Math.cos(th), uz=Math.sin(th);
      live.push({cls:'plane',key:'plane',g,cx:cam.position.x+fx*d,cz:cam.position.z+fz*d,ux,uz,s:-(halfW(d)+25),y:Math.max(cam.position.y+10,skyY(d,rnd2(0.45,0.7))),life:0,seenT:false,gone:0,hw:true}); return; }
    const th=Math.random()*6.28, ux=Math.cos(th), uz=Math.sin(th), o=rnd2(-160,160);
    const cx=cam.position.x-uz*o, cz=cam.position.z+ux*o; live.push({cls:'plane',key:'plane',g,cx,cz,ux,uz,s:-650,y:rnd2(150,210),life:0,seenT:false,gone:0}); }
  function tickPlane(a,dt,t){ a.s+=72*dt; a.x=a.cx+a.ux*a.s; a.z=a.cz+a.uz*a.s; a.y+=dt*1.5; a.g.position.set(a.x,a.y,a.z); a.g.rotation.set(-0.04,Math.atan2(a.ux,a.uz),0);
    a.g.userData.strobe.visible=(t*1.2%1)<0.08; }
  function spawnKite(hw){ const [fx,fz]=fwd(), d=hw?rnd2(55,80):rnd2(60,130); const cx=cam.position.x+fx*d, cz=cam.position.z+fz*d;
    live.push({cls:'kite',key:'kite',g:take('kite',kite),cx,cz,R:hw?rnd2(16,24):rnd2(22,40),ang:Math.random()*6.28,dir:Math.random()<0.5?1:-1,y:hw?Math.max(cam.position.y+6,skyY(d,rnd2(0.35,0.55))):rnd2(42,62),T:rnd2(hw?14:25,hw?22:40),life:0,seenT:false,gone:0,hw:!!hw}); }
  // 遊隼：滑翔 → 俯衝 → 拉返上去飛走
  function spawnFalcon(hw){ const [fx,fz]=fwd(), d=hw?rnd2(70,95):rnd2(80,140), sd=Math.random()<0.5?1:-1, px=-fz*sd, pz=fx*sd, lw=hw?halfW(d)*0.8:45;
    live.push({cls:'falcon',key:'falcon',g:take('falcon',falcon),x:cam.position.x+fx*d-px*lw,z:cam.position.z+fz*d-pz*lw,y:hw?Math.max(cam.position.y+8,skyY(d,rnd2(0.4,0.55))):cam.position.y+rnd2(40,55),hx:px*0.9-fx*0.3,hz:pz*0.9-fz*0.3,ph:'glide',pt:rnd2(1.8,2.6),life:0,seenT:false,gone:0,hw:!!hw}); }
  function tickFalcon(a,dt,t){ const W=a.g.userData.wing; a.pt-=dt; let v=20, vy=0, pitch=0;
    if(a.ph==='glide'){ W.scale.x=1; if(a.pt<0){ a.ph='dive'; a.pt=1.3; } }
    else if(a.ph==='dive'){ v=34; vy=-20; pitch=0.7; W.scale.x=0.45; if(a.pt<0||a.y<cam.position.y-6){ a.ph='climb'; a.pt=9; } }
    else { v=24; vy=9; pitch=-0.35; W.scale.x=0.7+0.3*Math.abs(Math.sin(t*14)); }
    const l=Math.hypot(a.hx,a.hz)||1; a.x+=a.hx/l*v*dt; a.z+=a.hz/l*v*dt; a.y=Math.max(4,a.y+vy*dt);
    a.g.position.set(a.x,a.y,a.z); a.g.rotation.set(pitch,Math.atan2(a.hx,a.hz),0); }
  function tickKite(a,dt,t){ const w=a.dir*0.32; if(a.life<a.T){ a.ang+=w*dt; a.x=a.cx+Math.cos(a.ang)*a.R; a.z=a.cz+Math.sin(a.ang)*a.R; a.hx=-Math.sin(a.ang)*a.dir; a.hz=Math.cos(a.ang)*a.dir; a.roll=a.dir*0.35; }
    else { a.x+=a.hx*11*dt; a.z+=a.hz*11*dt; a.y+=dt*2; a.roll*=0.98; }
    a.g.position.set(a.x,a.y,a.z); a.g.rotation.set(0,Math.atan2(a.hx,a.hz),0); a.g.rotateZ(-a.roll); const fl=(t%9)<1.2?Math.abs(Math.sin(t*10)):0; a.g.scale.set(1.5*(1-fl*0.25),1.5,1.5); }

  /* ----- 每格 ----- */
  const T={g:2,d:3,p:rnd2(12,30),k:rnd2(8,20),hc:0}, HW={on:false,wait:2};
  const HWN=REGION==='tm'?['元朗公路','天水圍路']:['沙田路','大埔公路'];
  function onHighway(){ const c=S.car; if(REGION==='tm'&&ELEV(c.x,c.z)>3) return true;
    for(const r of MAP.roads){ if(!HWN.includes(r.name)) continue; const A=NODES[r.n[0]],B=NODES[r.n[1]], dx=B[0]-A[0],dz=B[1]-A[1],L2=dx*dx+dz*dz||1; let k=((c.x-A[0])*dx+(c.z-A[1])*dz)/L2; k=Math.max(0,Math.min(1,k));
      const qx=A[0]+dx*k-c.x, qz=A[1]+dz*k-c.z; if(qx*qx+qz*qz<(r.w/2+2)**2) return REGION!=='tm'||ELEV(c.x,c.z)>1||!r.elev; } return false; }
  function tick(dt,t){
    if(S.mode==='menu'||S.mode==='cpr'||!CFG.on){ if(live.length) clear(); return; }
    if(S.mode!=='drive') return;
    const night=!!(TOD[S.level&&S.level.tod]||{}).night, rain=!!S.wet, NG=rain?Math.ceil(CFG.ground/2):CFG.ground;
    if((T.g-=dt)<0){ T.g=rnd2(2.5,5)*4/Math.max(4,CFG.ground); if(count('ground')<NG) spawnGround(); }
    if((T.d-=dt)<0){ T.d=rnd2(4,8)*2/Math.max(2,CFG.ducks); if(!night&&count('duck')<CFG.ducks) spawnDucks(); }
    if((T.p-=dt)<0){ T.p=rnd2(45,90); if(CFG.plane&&!count('plane')) spawnPlane(); }
    if((T.k-=dt)<0){ T.k=rnd2(30,60); if(CFG.kite&&!night&&!rain&&!count('kite')) Math.random()<0.7?spawnKite():(!count('falcon')&&spawnFalcon()); }
    // 高速公路：駛上去 3 秒內一定有飛機或者猛禽喺前面天空飛過；之後每 15–25 秒再嚟
    if((T.hc-=dt)<0){ T.hc=0.4; HW.on=onHighway(); if(!HW.on) HW.wait=rnd2(1.2,3); }
    if(HW.on){ const sky=live.some(a=>!a.dead&&(a.cls==='plane'||a.cls==='kite'||a.cls==='falcon')&&(a.hw||a.seenT));
      if(!sky&&(HW.wait-=dt)<0){ const day=!night&&!rain&&CFG.kite, q=Math.random();
        if(!CFG.plane&&!day){ HW.wait=5; } else { if(CFG.plane&&(!day||q<0.5)){ live.filter(a=>a.cls==='plane').forEach(free); spawnPlane(true); } else if(q<0.75) spawnKite(true); else spawnFalcon(true); HW.wait=rnd2(15,25); } } }
    const far=Math.min(cam.far,scene.fog.far+40);
    for(const a of live){ a.life+=dt;
      if(a.cls==='ground') tickGround(a,dt,t); else if(a.cls==='duck') tickDuck(a,dt,t); else if(a.cls==='plane') tickPlane(a,dt,t); else if(a.cls==='falcon') tickFalcon(a,dt,t); else tickKite(a,dt,t);
      const isP=a.cls==='plane'||a.cls==='kite'||a.cls==='falcon', v=seen(a.x,(a.y||0)+1,a.z,a.cls==='plane'?16:isP?4:3,isP?cam.far:far);
      if(v){ a.seenT=true; a.gone=0; } else if(a.seenT) a.gone+=dt;
      const dc=Math.hypot(a.x-cam.position.x,a.z-cam.position.z);
      if(a.gone>0.8||(!a.seenT&&a.life>(a.cls==='plane'?25:30))||(a.cls!=='plane'&&dc>360)||(a.cls==='plane'&&a.s>700)) free(a); }
    for(let i=live.length-1;i>=0;i--) if(live[i].dead) live.splice(i,1); }
  // 設定：改完即時生效（關閉或者某類動物唔要就即刻收返）
  function setCfg(c){ CFG=c; store.set('ani',c); for(const a of live){ if(!c.on||(a.cls==='ground'&&!c.types[a.kind])||(a.cls==='plane'&&!c.plane)||((a.cls==='kite'||a.cls==='falcon')&&!c.kite)) free(a); }
    let g=live.filter(a=>!a.dead&&a.cls==='ground'), d=live.filter(a=>!a.dead&&a.cls==='duck'); g.slice(c.ground).forEach(free); d.slice(c.ducks).forEach(free);
    for(let i=live.length-1;i>=0;i--) if(live[i].dead) live.splice(i,1); }
  return {tick,clear,live,cfg:()=>JSON.parse(JSON.stringify(CFG)),setCfg,def:ANI_DEF,sp:{g:spawnGround,d:spawnDucks,p:spawnPlane,k:spawnKite,f:spawnFalcon},hw:()=>HW.on};
})();
window.__ANI=ANI;
/* ---------- 畫面質素自動檢查：揸車頭 8 秒平均每秒少過 25 格，就問要唔要降一級（每部機只問一次） ---------- */
const GFXW={t:0,n:0,done:store.get('gfxAsked',false)||!GFX};
function gfxWatch(dt){ if(GFXW.done) return; const now=performance.now(); if(S.mode!=='drive'||document.hidden){ GFXW.t0=0; GFXW.n=0; return; } if(!GFXW.t0){ GFXW.t0=now; GFXW.n=0; return; } GFXW.n++; if(now-GFXW.t0<8000) return; GFXW.done=true;
  const fps=GFXW.n/((now-GFXW.t0)/1000); if(fps>=25) return; if(!DRES.atMin){ GFXW.done=false; GFXW.t0=0; return; } store.set('gfxAsked',true);   // 自動解像度降到最低都仲慢先問
  const lv=GFX>=2?1:0, nm=lv?'精細':'標準', box=document.createElement('div'); box.className='gfxAsk';
  box.innerHTML='<div class="card"><b>🖼️ 部機有啲吃力</b><p>而家大約每秒 '+Math.round(fps)+' 格。轉做「'+nm+'」會順好多（要重新載入地圖）。</p><div class="gfxBtns"><button class="sec">唔使</button><button class="pri">轉做'+nm+'</button></div></div>';
  document.body.append(box); const [no,yes]=box.querySelectorAll('button'); no.onclick=()=>box.remove(); yes.onclick=()=>{ store.set('gfx',lv); location.reload(); }; }

/* ---------- 🎉 歡樂模式（隱藏）：長按選單左上角 A188 五秒解鎖 ----------
   只喺歡樂模式生效：全車性能解放、上行人路唔減速、撞人噴紅色液體同血泊、撞車爆炸彈飛、
   🚀 氮氣加速、連環撞分數、慢鏡、七彩警號燈、彩紙、唔會扣心／唔會 Game Over（亦唔計正式成績同成就） */
/* ----- 長按解鎖 ----- */
{ const b=document.querySelector('#menu .badge'); let tm=null, t0=0, raf=0;
  const ring=()=>{ const p=Math.min(1,(performance.now()-t0)/5000); b.style.background='conic-gradient(#ff2d95 '+(p*360)+'deg, var(--red, #e23b3b) 0)'; b.style.transform='scale('+(1+p*0.25)+')'; if(p<1) raf=requestAnimationFrame(ring); };
  const stop=()=>{ clearTimeout(tm); tm=null; cancelAnimationFrame(raf); b.style.background=''; b.style.transform=''; };
  const done=()=>{ stop(); const first=!FUN.unlocked; FUN.unlocked=true; FUN.on=true; store.set('funU',1); store.set('funOn',1); vib(200);
      toast(first?'🎉 歡樂模式已解鎖！喺「設定」可以開關':'🎉 歡樂模式：開'); renderMenu('set'); try{ funBurst(); }catch(e){} };
  b.addEventListener('pointerdown',e=>{ t0=performance.now(); raf=requestAnimationFrame(ring); tm=setTimeout(done,5000); });
  b.addEventListener('pointerup',()=>{ if(tm&&performance.now()-t0>=5000) done(); else stop(); });   // 部機忙嘅時候計時器會遲，放手時再計一次
  ['pointerleave','pointercancel'].forEach(k=>b.addEventListener(k,stop));
  b.addEventListener('contextmenu',e=>e.preventDefault()); }
function funSet(v){ FUN.on=!!v&&FUN.unlocked; store.set('funOn',FUN.on?1:0); funHud(); }

/* ----- 共用貼圖 ----- */
const FXT={
  glow:canvasTex(64,64,(g,w,h)=>{ const r=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2); r.addColorStop(0,'rgba(255,255,220,1)'); r.addColorStop(0.3,'rgba(255,190,60,.95)'); r.addColorStop(0.7,'rgba(255,80,0,.5)'); r.addColorStop(1,'rgba(120,20,0,0)'); g.fillStyle=r; g.fillRect(0,0,w,h); },false),
  smoke:canvasTex(64,64,(g,w,h)=>{ const r=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2); r.addColorStop(0,'rgba(70,70,70,.85)'); r.addColorStop(0.6,'rgba(50,50,50,.5)'); r.addColorStop(1,'rgba(40,40,40,0)'); g.fillStyle=r; g.fillRect(0,0,w,h); },false),
  pool:canvasTex(128,128,(g,w,h)=>{ g.beginPath(); for(let i=0;i<=28;i++){ const a=i/28*Math.PI*2, r=w*0.42*(0.86+0.14*Math.sin(i*2.7)+0.06*Math.cos(i*5.3)); g.lineTo(w/2+Math.cos(a)*r,h/2+Math.sin(a)*r); } g.closePath();
    const r=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w*0.45); r.addColorStop(0,'#5c0000'); r.addColorStop(0.75,'#8c0000'); r.addColorStop(1,'#a30a0a'); g.fillStyle=r; g.fill(); g.fillStyle='rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(w*0.4,h*0.38,w*0.1,h*0.05,-0.5,0,6.3); g.fill(); },false) };
/* ----- 粒子：紅色液體、碎片、彩紙（InstancedMesh，三個繪製） ----- */
function partSys(n,geo,mat,colored){ const im=new THREE.InstancedMesh(geo,mat,n); im.frustumCulled=false; im.count=0; scene.add(im);
  const P=[]; for(let i=0;i<n;i++) P.push({life:0}); if(colored) im.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(n*3),3);
  const o=new THREE.Object3D(), col=new THREE.Color(); let next=0;
  return { emit(x,y,z,vx,vy,vz,life,s,hex,spin){ const p=P[next]; next=(next+1)%n; Object.assign(p,{x,y,z,vx,vy,vz,life,max:life,s,stuck:false,rx:Math.random()*6,ry:Math.random()*6,spin:spin||0}); if(colored){ col.setHex(hex); im.setColorAt(P.indexOf(p),col); im.instanceColor.needsUpdate=true; } },
    tick(dt,ground){ let k=0; for(let i=0;i<n;i++){ const p=P[i]; if(p.life<=0) continue; p.life-=dt;
        if(!p.stuck){ p.vy-=(ground==='paper'?3:22)*dt; if(ground==='paper'){ p.vx*=0.98; p.vz*=0.98; p.vy=Math.max(p.vy,-2.5); } p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt; p.rx+=p.spin*dt; p.ry+=p.spin*0.7*dt;
          if(p.y<0.16){ p.y=0.16; if(ground==='splat'){ p.stuck=true; p.vx=p.vz=p.vy=0; } else { p.vy=-p.vy*0.3; p.vx*=0.6; p.vz*=0.6; p.spin*=0.5; } } }
        const fade=Math.min(1,p.life/0.5); o.position.set(p.x,p.y,p.z);
        if(p.stuck){ o.rotation.set(0,p.ry,0); o.scale.set(p.s*2.2*fade,0.05,p.s*2.2*fade); } else { o.rotation.set(p.rx,p.ry,0); o.scale.setScalar(p.s*fade); }
        o.updateMatrix(); im.setMatrixAt(i,o.matrix); k=i+1; }
      for(let i=0;i<k;i++) if(P[i].life<=0){ o.scale.setScalar(0); o.updateMatrix(); im.setMatrixAt(i,o.matrix); }
      im.count=k; im.instanceMatrix.needsUpdate=true; } }; }
const BLOOD=partSys(260,new THREE.SphereGeometry(1,6,4),new THREE.MeshLambertMaterial({color:0xa00000}),false);
const DEBRIS=partSys(140,new THREE.BoxGeometry(1,0.5,1),new THREE.MeshLambertMaterial({color:0xffffff}),true);
const PAPER=partSys(320,new THREE.PlaneGeometry(1,0.6),new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide}),true);
/* ----- 火球、煙（Sprite 池，每個自己材質方便淡出） ----- */
const SPR=[]; function sprite(map,add){ let s=SPR.find(q=>!q.visible&&q.userData.add===add); if(!s){ s=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthWrite:false,blending:add?THREE.AdditiveBlending:THREE.NormalBlending})); s.userData.add=add; scene.add(s); SPR.push(s); } s.visible=true; return s; }
const FLASH=new THREE.PointLight(0xffa040,0,60,2); scene.add(FLASH);
function explode(x,y,z,power){ const P=Math.min(2.2,0.6+power/20);
  for(let i=0;i<7;i++){ const s=sprite(FXT.glow,true); s.position.set(x+(Math.random()-0.5)*2*P,y+1+Math.random()*1.5*P,z+(Math.random()-0.5)*2*P); s.userData.t=0; s.userData.max=0.55+Math.random()*0.4; s.userData.sz=(3+Math.random()*3)*P; s.userData.vy=1.5; s.material.opacity=1; s.scale.setScalar(0.5); }
  for(let i=0;i<8;i++){ const s=sprite(FXT.smoke,false); s.position.set(x+(Math.random()-0.5)*3,y+1.5,z+(Math.random()-0.5)*3); s.userData.t=-Math.random()*0.3; s.userData.max=2.2+Math.random(); s.userData.sz=(4+Math.random()*4)*P; s.userData.vy=2.2+Math.random()*1.5; s.material.opacity=0; s.scale.setScalar(1); }
  for(let i=0;i<Math.round(16*P);i++){ const a=Math.random()*6.28, v=6+Math.random()*10*P; DEBRIS.emit(x,y+1.2,z,Math.cos(a)*v,5+Math.random()*9*P,Math.sin(a)*v,2.4,0.25+Math.random()*0.35,[0x333333,0x777777,0xff7a00,0xffd000,0x222222][i%5],8+Math.random()*10); }
  FLASH.position.set(x,y+3,z); FLASH.intensity=6*P; S.shake=Math.max(S.shake||0,0.5+0.3*P); vib(120); funBoom(P); }
function bleed(x,z,dirx,dirz,sp){ const n=18+Math.min(30,sp*1.5|0);
  for(let i=0;i<n;i++){ const a=Math.atan2(dirx,dirz)+(Math.random()-0.5)*1.6, v=2+Math.random()*(3+sp*0.25); BLOOD.emit(x,1.3+Math.random()*0.5,z,Math.sin(a)*v,3+Math.random()*5,Math.cos(a)*v,4+Math.random()*3,0.07+Math.random()*0.09); } }
// 血泊：倒地之後由細變大
const POOLS=[]; function bloodPool(x,z,base){ let m=POOLS.find(q=>!q.visible); if(!m){ if(POOLS.length>=14){ m=POOLS.sort((a,b)=>a.userData.t0-b.userData.t0)[0]; } else { m=new THREE.Mesh(new THREE.CircleGeometry(1,24),new THREE.MeshLambertMaterial({map:FXT.pool,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3})); m.rotation.x=-Math.PI/2; m.renderOrder=1; scene.add(m); POOLS.push(m); } }
  m.visible=true; m.position.set(x,(base||0)+0.17,z); m.rotation.z=Math.random()*6.28; m.userData={t0:performance.now(),age:0,R:1.5+Math.random()*0.7}; m.scale.setScalar(0.05); m.material.opacity=1; }

/* ----- 撞人／撞車 ----- */
function funHitPed(p,c){ const sp=Math.abs(c.v); bleed(p.pos[0],p.pos[1],Math.sin(c.a),Math.cos(c.a),sp); p.funPool=true; pedFly(p,c); c.v/=0.85; funScore(100,'💥 撞飛路人'); }
function funHitCar(k,c){ const sp=Math.abs(c.v); if(k.fly||sp<3) return false; const pos=k.pose; explode(pos.x,ELEV(pos.x,pos.z),pos.z,sp);
  const a=Math.atan2(pos.x-c.x,pos.z-c.z); k.fly={x:pos.x,y:ELEV(pos.x,pos.z),z:pos.z,vx:Math.sin(a)*sp*0.45+Math.sin(c.a)*sp*0.55,vz:Math.cos(a)*sp*0.45+Math.cos(c.a)*sp*0.55,vy:6+sp*0.45,rx:(Math.random()-0.5)*6,ry:(Math.random()-0.5)*5,rz:(Math.random()-0.5)*8,t:0,smoke:0};
  k.pose=null; c.v*=0.9; if(sp>18){ FUN.slow=0.7; } funScore(Math.round(200+sp*15),sp>18?'🔥 爆炸飛車！':'💥 撞爆車'); return true; }
function funCarTick(k,dt){ const f=k.fly; f.t+=dt; const m=k.m;
  if(f.y>0||f.vy>0){ f.vy-=20*dt; f.x+=f.vx*dt; f.z+=f.vz*dt; f.y=Math.max(0,f.y+f.vy*dt); m.rotation.x+=f.rx*dt; m.rotation.y+=f.ry*dt; m.rotation.z+=f.rz*dt;
    if(f.y===0&&f.vy<0){ f.vy=f.vy<-5?-f.vy*0.3:0; f.vx*=0.5; f.vz*=0.5; f.rx*=0.4; f.rz*=0.4; if(Math.abs(f.vy)<1){ m.rotation.x=Math.round(m.rotation.x/Math.PI)*Math.PI; m.rotation.z=Math.round(m.rotation.z/Math.PI)*Math.PI; } } }
  m.position.set(f.x,f.y+0.1,f.z); f.smoke-=dt; if(f.smoke<0&&f.t<7){ f.smoke=0.25; const s=sprite(FXT.smoke,false); s.position.set(f.x,f.y+1.5,f.z); s.userData.t=0; s.userData.max=1.8; s.userData.sz=3; s.userData.vy=2.5; s.material.opacity=0; }
  if(f.t>6&&!inView(f.x,f.z,6)){ m.rotation.set(0,0,0); k.fly=null; if(!placeCar(k,S.car.x,S.car.z)){ k.fly=f; f.t=5; } } }

/* ----- 分數、連環、慢鏡、七彩 ----- */
const funEl=document.createElement('div'); funEl.id='funTxt'; document.body.append(funEl);
const funHudEl=document.createElement('div'); funHudEl.id='funHud'; document.body.append(funHudEl);
function funHud(){ funHudEl.style.display=FUN.on&&S.mode==='drive'?'block':'none'; funHudEl.textContent='🎉 '+FUN.score.toLocaleString(); const n=$('bN'); if(n) n.style.display=FUN.on?'':'none'; }
function funScore(pts,label){ FUN.combo=FUN.comboT>0?FUN.combo+1:1; FUN.comboT=3; const mul=Math.min(10,FUN.combo); FUN.score+=pts*mul; funHud();
  funEl.innerHTML=label+(FUN.combo>1?'<br><b>COMBO ×'+FUN.combo+'</b>':'')+'<small>+'+(pts*mul)+'</small>'; funEl.classList.remove('pop'); void funEl.offsetWidth; funEl.classList.add('pop');
  if(FUN.combo>=5&&FUN.combo%5===0) funBurst(); }
function funBurst(){ const c=cam.position; const fw=new THREE.Vector3(); cam.getWorldDirection(fw);
  for(let i=0;i<120;i++){ PAPER.emit(c.x+fw.x*14+(Math.random()-0.5)*16,c.y+4+Math.random()*6,c.z+fw.z*14+(Math.random()-0.5)*16,(Math.random()-0.5)*6,Math.random()*4,(Math.random()-0.5)*6,4+Math.random()*2,0.35+Math.random()*0.25,[0xff2d95,0xffd400,0x2bd4ff,0x7cff4f,0xff7a00,0xb26bff][i%6],6+Math.random()*8); } }
let funAC=null; function funBoom(P){ try{ funAC=funAC||new (window.AudioContext||window.webkitAudioContext)(); const a=funAC, n=a.createBufferSource(), len=a.sampleRate*0.9, b=a.createBuffer(1,len,a.sampleRate), d=b.getChannelData(0);
  for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.2); n.buffer=b; const f=a.createBiquadFilter(); f.type='lowpass'; f.frequency.value=700; const g=a.createGain(); g.gain.value=Math.min(1,0.35*P); n.connect(f).connect(g).connect(a.destination); n.start(); }catch(e){} }
// 每格：dt 經過呢度做慢鏡
function funTime(dt){ if(!FUN.on) return dt; if(FUN.slow>0){ FUN.slow-=dt; return dt*0.35; } return dt; }
function funTick(dt,t){ BLOOD.tick(dt,'splat'); DEBRIS.tick(dt,'bounce'); PAPER.tick(dt,'paper');
  SPR.forEach(s=>{ if(!s.visible) return; const u=s.userData; u.t+=dt; if(u.t<0) return; const k=u.t/u.max; if(k>=1){ s.visible=false; return; }
    s.position.y+=u.vy*dt; s.scale.setScalar(u.add?u.sz*(0.3+k*0.9):u.sz*(0.4+k)); s.material.opacity=u.add?(1-k):Math.min(0.75,k*4)*(1-k); });
  FLASH.intensity=Math.max(0,FLASH.intensity-dt*18);
  POOLS.forEach(m=>{ if(!m.visible) return; const u=m.userData; u.age+=dt; m.scale.setScalar(Math.max(0.05,u.R*Math.min(1,u.age/2.2))*(1-Math.max(0,u.age-40)/10)); if(u.age>50) m.visible=false; });
  if(FUN.comboT>0){ FUN.comboT-=dt; if(FUN.comboT<=0) FUN.combo=0; }
  // 氮氣火焰
  if(FUN.on&&S.hold.N&&S.mode==='drive'&&S.car.v>5){ const c=S.car; for(let k=0;k<2;k++){ const s=sprite(FXT.glow,true); s.position.set(c.x-Math.sin(c.a)*(3.6*VSPEC.kl)+(Math.random()-0.5)*0.6,ELEV(c.x,c.z)+0.7,c.z-Math.cos(c.a)*(3.6*VSPEC.kl)+(Math.random()-0.5)*0.6); s.userData.t=0; s.userData.max=0.25; s.userData.sz=1.6; s.userData.vy=0; s.material.opacity=1; } }
  if((FUN.hudT=(FUN.hudT||0)-dt)<0){ FUN.hudT=0.5; funHud(); } }
// 彈出字樣
{ const st=document.createElement('style'); st.textContent=`#funTxt{position:fixed;left:50%;top:32%;transform:translate(-50%,-50%) scale(0);pointer-events:none;z-index:40;text-align:center;font-weight:900;font-size:26px;color:#fff;text-shadow:0 0 8px #ff2d95,0 0 18px #ff2d95,2px 2px 0 #000;opacity:0;white-space:nowrap}
#funTxt b{font-size:34px;color:#ffe600;text-shadow:0 0 10px #ff7a00,2px 2px 0 #000}#funTxt small{display:block;font-size:16px;color:#7cff4f}
#funTxt.pop{animation:funPop 1.3s ease-out forwards}@keyframes funPop{0%{transform:translate(-50%,-50%) scale(.3);opacity:0}15%{transform:translate(-50%,-50%) scale(1.25);opacity:1}30%{transform:translate(-50%,-50%) scale(1)}80%{opacity:1}100%{transform:translate(-50%,-80%) scale(1);opacity:0}}
#funHud{position:fixed;left:50%;top:calc(118px + env(safe-area-inset-top));transform:translateX(-50%);display:none;z-index:30;background:linear-gradient(90deg,#ff2d95,#ff7a00,#ffd400);color:#fff;font-weight:900;font-size:15px;padding:4px 14px;border-radius:99px;text-shadow:1px 1px 0 #0006;pointer-events:none}
.btn.nitro{background:linear-gradient(#ff7a00,#ff2d95);color:#fff;font-size:20px}`; document.head.append(st); }
// 🚀 氮氣掣（Shift 鍵都得）
{ const col=document.querySelector('.btns .right .col'); if(col){ const b=document.createElement('button'); b.className='btn small nitro'; b.id='bN'; b.setAttribute('aria-label','氮氣加速'); b.textContent='🚀'; b.style.display=FUN.on?'':'none'; col.prepend(b); bindHold('bN','N'); } }
addEventListener('keydown',e=>{ if(e.key==='Shift') S.hold.N=true; }); addEventListener('keyup',e=>{ if(e.key==='Shift') S.hold.N=false; });
window.__FUN=FUN;
window.__funHitCar=funHitCar; window.__funHitPed=funHitPed;

/* ---------- 🎬 寫實模式：黃昏光影＋光暈（bloom）＋電影調色、低鏡頭、GTA 式介面（派遣接 Call、圓形小地圖、狀態條、錢、時間） ----------
   只係救護任務嘅另一種玩法外觀；關卡、路線同計分照用救護任務。 */
TOD.real={sky:0x2c2f52,hemi:[0xb4a6d6,0x3b3046,0.5],sun:[0xff9a5a,0.55],fog:[110,430],cloud:0x7a6f9a,night:true};
const REAL={on:false,comp:null,stress:0,cash:store.get('realCash',0),clock:0,dispatch:false};
// 天空：由地平線橙粉色漸變到頂部深藍（只喺寫實模式）
const realSky=(()=>{ const g=new THREE.SphereGeometry(400,32,16), col=[], P=g.attributes.position, c=new THREE.Color();
  const H=new THREE.Color(0xff9a6a), M=new THREE.Color(0x8a6aa8), T=new THREE.Color(0x1a2048);
  for(let i=0;i<P.count;i++){ const y=P.getY(i)/400; if(y<0.04) c.copy(H).lerp(M,Math.max(0,y)/0.04); else if(y<0.3) c.copy(M).lerp(T,(y-0.04)/0.26); else c.copy(T); if(y<0) c.copy(H).multiplyScalar(0.6); col.push(c.r,c.g,c.b); }
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false})); m.renderOrder=-10; m.visible=false; m.frustumCulled=false; scene.add(m); return m; })();
// 調色：邊位少少色散、對比、暗位偏藍／亮位偏橙、飽和度、暗角、菲林顆粒
const GRADE={uniforms:{tDiffuse:{value:null},time:{value:0}},
  vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader:`uniform sampler2D tDiffuse; uniform float time; varying vec2 vUv;
    void main(){ vec2 d=vUv-0.5; float r=dot(d,d); float ca=0.0025*r;
      vec3 col=vec3(texture2D(tDiffuse,vUv+d*ca).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-d*ca).b);
      col*=1.03; col=(col-0.5)*1.05+0.5;
      float l=dot(col,vec3(0.299,0.587,0.114));
      col=mix(col,col*vec3(0.9,0.95,1.1),(1.0-l)*0.22); col=mix(col,col*vec3(1.08,1.0,0.9),l*0.15);
      col=mix(vec3(l),col,1.06);
      col*=1.0-smoothstep(0.2,0.7,r*1.5)*0.28;
      float n=fract(sin(dot(vUv*vec2(12.9898,78.233)+time,vec2(1.0)))*43758.5453); col+=(n-0.5)*0.012;
      gl_FragColor=vec4(clamp(col,0.0,1.0),1.0); }`};
function realComposer(){ if(REAL.comp) return REAL.comp; const w=innerWidth, h=innerHeight;
  const C=new THREE.EffectComposer(R); C.addPass(new THREE.RenderPass(scene,cam));
  const bloom=new THREE.UnrealBloomPass(new THREE.Vector2(w/2,h/2),0.42,0.4,0.9); C.addPass(bloom);
  const gp=new THREE.ShaderPass(GRADE); C.addPass(gp); REAL.gp=gp; REAL.bloom=bloom;
  addEventListener('resize',()=>{ C.setSize(innerWidth,innerHeight); bloom.setSize(innerWidth/2,innerHeight/2); }); return REAL.comp=C; }
function realRender(t){ if(!REAL.fx){ R.render(scene,cam); return; } REAL.gp.uniforms.time.value=t%10; realSky.position.copy(cam.position); REAL.comp.render(); }

/* ----- 介面 ----- */
const RH=(()=>{ const d=document.createElement('div'); d.id='rHud'; d.innerHTML=`
  <div id="rMis"><div class="mt"><div class="ic">🚑</div><div><small id="rmS">緊急輔助醫療救護服務</small><b id="rmT">--</b><span id="rmP">--</span><span class="row">距離 <b id="rmD">--</b> · <span id="rmLl">限時</span> <b id="rmL">--</b></span></div></div>
    <div id="rBars"><div class="rb"><i>❤️</i><span>病人狀況</span><em id="rb1t">穩定</em><div><u id="rb1"></u></div></div>
    <div class="rb"><i>⏱️</i><span>剩餘時間</span><em id="rb2t">--</em><div><u id="rb2"></u></div></div>
    <div class="rb"><i>🔥</i><span>壓力值</span><em id="rb3t">低</em><div><u id="rb3"></u></div></div></div></div>
  <div id="rDisp"><div class="hd"><div class="ic blue"><svg viewBox="-12 -12 24 24" width="28" height="28"><g fill="#fff"><rect x="-3" y="-11" width="6" height="22" rx="1"/><rect x="-3" y="-11" width="6" height="22" rx="1" transform="rotate(60)"/><rect x="-3" y="-11" width="6" height="22" rx="1" transform="rotate(-60)"/></g><path d="M0-7V7" stroke="#1e5bd8" stroke-width="1.6"/></svg></div><div><b>緊急輔助醫療救護服務</b><span>接 CALL</span></div><div class="ph">📞</div></div>
    <p class="who" id="rdW">A188 救護車<br>收到控制中心指示</p><p class="cs" id="rdC">--</p><p class="pl" id="rdP">--</p>
    <div class="bt"><button id="rRes">RES</button><button id="rRej">REJ</button></div><div class="bl"><span>接受</span><span>拒絕</span></div></div>
  <div id="rTR"><div id="rlStars"></div><div id="rCash">$0</div><div id="rClock">時間：19:30</div><div id="rTag"><b>AMBULANCE ${CALLSIGN}</b><span>${REGION!=='tm'?'SHA TIN':'TUEN MUN'}</span><em id="rAvm"></em></div></div>`;
  document.body.append(d);
  const st=document.createElement('style'); st.textContent=`#rHud{display:none}body.real #rHud{display:block}
  body.real .top .card,body.real #stabBox,body.real #callBox{display:none!important}
  body.real #mini{position:fixed;left:12px;bottom:calc(132px + env(safe-area-inset-bottom));width:118px;height:118px;border:4px solid #2ea44f;border-right-color:#2563eb;border-bottom-color:#2563eb;box-shadow:0 4px 18px #0008;z-index:6}
  #rHud>div{position:fixed;z-index:6;color:#fff;font-family:inherit;text-shadow:0 1px 2px #000a}
  #rMis{left:10px;top:calc(10px + env(safe-area-inset-top));background:#141821d9;border-radius:10px;padding:7px 10px 7px 7px;max-width:min(62vw,330px);backdrop-filter:blur(3px)}
  #rMis .mt{display:flex;gap:8px}
  #rMis .ic,#rDisp .ic{width:38px;height:38px;flex:none;border-radius:8px;background:#c62828;display:grid;place-items:center;font-size:20px}
  #rMis small{display:block;font-size:10px;color:#ffb4b4;letter-spacing:1px}#rMis b{display:block;font-size:14px}#rMis span{display:block;font-size:12px;color:#d9dde3}#rMis .row{font-size:11px;margin-top:2px}#rMis .row b,#rMis .row span{display:inline;font-size:12px}#rMis .row b{color:#ffd166}
  #rMis.avm .ic{background:#2e7d32}#rMis.avm small{color:#a5f3b5}
  #rBars{display:flex;flex-direction:column;gap:3px;margin-top:6px;transition:opacity .3s,max-height .3s;max-height:90px;overflow:hidden}#rBars.hide{opacity:0;max-height:0;margin-top:0}
  .rb{display:grid;grid-template-columns:18px auto 32px 1fr;align-items:center;gap:4px;font-size:11px}
  .rb i{font-style:normal}.rb span{white-space:nowrap}.rb em{font-style:normal;font-weight:800;color:#ff8a65}.rb div{height:8px;min-width:50px;border:1.5px solid #ff6b4a;border-radius:5px;overflow:hidden}.rb u{display:block;height:100%;width:50%;background:linear-gradient(90deg,#ff3b2f,#ff8a3d)}
  #rDisp{left:10px;right:10px;top:calc(76px + env(safe-area-inset-top));max-width:340px;background:#141821ee;border-radius:12px;padding:10px;display:none}
  #rDisp.on{display:block;animation:rIn .35s ease-out}@keyframes rIn{from{transform:translateX(-30px);opacity:0}}
  #rDisp .hd{display:flex;gap:9px;align-items:center}#rDisp .ic.blue{background:#1e5bd8;font-size:24px}#rDisp .hd b{display:block;font-size:17px;color:#ffcf9a}#rDisp .hd span{font-size:16px;color:#ffcf9a}
  #rDisp .ph{margin-left:auto;font-size:24px;animation:rRing .5s infinite alternate}@keyframes rRing{to{transform:rotate(-18deg) scale(1.12)}}
  #rDisp p{margin:6px 2px;font-size:15px;line-height:1.35}#rDisp .cs{font-size:18px;font-weight:800}#rDisp .pl{font-size:16px;color:#d9dde3}
  #rDisp .bt{display:flex;gap:10px;margin-top:8px}#rDisp .bt button{flex:1;font:inherit;font-size:22px;font-weight:800;color:#fff;border-radius:6px;padding:8px 0;border:2px solid #fff6}
  #rRes{background:#237a3b}#rRej{background:#a12a2a}#rDisp .bl{display:flex;gap:10px}#rDisp .bl span{flex:1;text-align:center;font-size:11px;color:#bbb}
  #rTR{right:10px;top:calc(118px + env(safe-area-inset-top));text-align:right}
  #rlStars{color:#2f6fe8;display:flex;gap:3px;justify-content:flex-end;filter:drop-shadow(0 1px 2px #000a)}#rlStars span{display:block;line-height:0}#rlStars .off{color:#ffffff30;opacity:.5}
  #rCash,#rTag{display:none!important}#rCash{font-size:24px;font-weight:900}#rClock{display:inline-block;margin-top:4px;background:#141821cc;border-radius:6px;padding:3px 9px;font-size:16px;font-weight:700}
  body.real #toast{top:auto;bottom:calc(222px + env(safe-area-inset-bottom));background:none;color:#fff;font-size:19px;font-weight:900;text-shadow:0 0 3px #000,0 2px 4px #000,0 0 10px #000;max-width:92vw;text-align:center;white-space:normal}
  body.real #cap{bottom:calc(250px + env(safe-area-inset-bottom))}
  #rTR{top:calc(10px + env(safe-area-inset-top))}
  #rTag{margin-top:4px;font-weight:900;letter-spacing:1px}#rTag b{display:block;font-size:12px}#rTag span{display:block;font-size:10px;color:#cfd4da}#rTag em{display:block;font-style:normal;font-size:11px;font-weight:900;color:#7dff9a}#rTag.hide{display:none}
  body.real #bMenu{top:calc(150px + env(safe-area-inset-top))!important}body.real #bAEB{top:calc(184px + env(safe-area-inset-top))!important}
  @media (orientation:portrait){ #rMis{max-width:56vw}
    body.real #toast{bottom:auto;top:calc(172px + env(safe-area-inset-top));font-size:14px;line-height:1.3;max-width:94vw} #rDisp{top:calc(84px + env(safe-area-inset-top))} }`; document.head.append(st);
  return d; })();
const rq_=id=>document.getElementById(id);
function realStars(){ rq_('rlStars').innerHTML=[0,1,2,3,4].map(i=>'<span class="'+(i<S.lives?'':'off')+'"><svg viewBox="-12 -12 24 24" width="22" height="22"><g fill="currentColor" stroke="#fff" stroke-width="1.2"><rect x="-3" y="-11" width="6" height="22" rx="1"/><rect x="-3" y="-11" width="6" height="22" rx="1" transform="rotate(60)"/><rect x="-3" y="-11" width="6" height="22" rx="1" transform="rotate(-60)"/></g><path d="M0-7V7" stroke="#fff" stroke-width="1.4"/></svg></span>').join(''); }
function realCash(){ rq_('rCash').textContent=REAL.cash.toLocaleString()+' 分'; }
/* ----- 開／關 ----- */
function realBegin(on){ REAL.on=!!on; if(!REAL.on&&S.pcHook) S.pcHook(false); document.body.classList.toggle('real',REAL.on); realSky.visible=false; REAL.fx=false;
  if(!REAL.on){ REAL.dispatch=false; REAL.avm=false; REAL.pend=null; rq_('rDisp').classList.remove('on'); cam.fov=FOV0; cam.updateProjectionMatrix(); return; }
  realComposer(); REAL.stress=0; REAL.jobs=0; REAL.shift=0; REAL.avm=false; REAL.jobAt=null; REAL.pend=null; REAL.ending=false; REAL.dep=S.level.depot; rq_('rMis').classList.remove('avm'); rq_('rmS').textContent='緊急輔助醫療救護服務'; REAL.clock={day:14*60+20,dusk:19*60+28,night:2*60+40,rain:4*60}[S.level.tod]??19*60+28;
  REAL.fx=S.level.tod!=='day'; realSky.visible=S.level.tod==='dusk';   // 日間照用日間；黃昏、夜晚、落雨先加光暈同調色
  if(S.level.tod==='dusk') setTOD('real');
  realStars(); realCash();
  const k=S.kase; rq_('rdC').textContent=k.title; rq_('rdP').textContent=k.place; rq_('rdW').innerHTML='A188 救護車<br>收到控制中心指示';
  if(S.pcHook) S.pcHook(!!S.pcPick);
  rq_('rDisp').classList.add('on'); REAL.dispatch=true; S.mode='dispatch'; vib([80,60,80]); }
rq_('rRes').onclick=()=>{ if(!REAL.dispatch) return; REAL.dispatch=false; rq_('rDisp').classList.remove('on');
  if(REAL.pend!=null){ const i=REAL.pend; REAL.pend=null; realNewJob(i); return; }
  S.mode='drive'; S.legStart=performance.now()/1000; toast('控制中心：'+S.kase.call); };
rq_('rRej').onclick=()=>{ if(!REAL.dispatch) return; REAL.dispatch=false; rq_('rDisp').classList.remove('on');
  if(REAL.pend!=null){ REAL.pend=null; toast('已拒絕 · 繼續 AVM 返'+DEPOT_NAME()); realAVMHud(); return; }
  toMenu(); };
const DEPOT_NAME=()=>{ const k=REAL.dep; return REGION!=='tm'?(k==='ts'?'田心救護站':'沙田救護站'):(k==='yl'?'元朗救護站':k==='tsw'?'天水圍救護站':'屯門救護站'); };
/* ----- 送院後：AVM（可供調派）返站，途中 30% 機會再接單 ----- */
function depotGate(){ const d=DEPOT.pos, fx=Math.sin(DEPOT.a), fz=Math.cos(DEPOT.a); for(let k=4;k<70;k+=2){ const px=d[0]+fx*k, pz=d[1]+fz*k; if(cellAt(px,pz)&1) return [px+fx*4,pz+fz*4]; } return d.slice(); }
function realAVMHud(){ hud('AVM · 返'+DEPOT_NAME(),'⑥ 可供調派 · 跟住橙色路線返站'); rq_('rmS').textContent='AVM · 可供調派'; rq_('rmT').textContent='返回'+DEPOT_NAME(); rq_('rMis').classList.add('avm'); }
function realFaceRoute(){   // AVM 一刻：車頭自動轉向路線方向
  const R=S.route; if(!R||R.pts.length<2) return; const c=S.car; let k=1; while(k<R.pts.length-1&&Math.hypot(R.pts[k][0]-c.x,R.pts[k][1]-c.z)<6) k++;
  const P=R.pts[k]; c.a=Math.atan2(P[0]-c.x,P[1]-c.z); c.v=0; S.camYaw=c.a; }
function realAVM(){   // 由 finish() 截住：交接完成 → AVM
  S.stars=S.lives; const pay=realPay(); REAL.jobs++; REAL.shift+=pay; REAL.avm=true; REAL.avmT=0;
  REAL.jobAt=Math.random()<0.9?6+Math.random()*22:null;   // 90%：返站途中再有新任務
  sirenSet(false); caption(null); clearEvents(); show('stabBox',false); patient.visible=false; bystander.visible=false;
  S.mode='drive'; S.step=6; S.leftDepot=true; S.depotCam=true; S.legLimit=1e6; S.legStart=performance.now()/1000;
  setTarget(depotGate()); refreshRoute(true); if(routeMesh) routeMesh.visible=true;
  realFaceRoute();
  realAVMHud(); toast('交接完成 +'+pay.toLocaleString()+' 分 · AVM 返站');
}
function realAtDepot(){ S.car.v=0; REAL.avm=false; REAL.ending=true; rq_('rMis').classList.remove('avm'); ring.visible=beacon.visible=arrow.visible=false; if(routeMesh) routeMesh.visible=false; finish(); REAL.ending=false; }
function realOffer(){   // 控制中心派新單
  const pool=LEVELS.map((_,i)=>i).filter(i=>i!==S.lvl&&LMK[caseOf(LEVELS[i]).poi]); if(!pool.length) return;
  const i=pool[Math.floor(Math.random()*pool.length)], k=caseOf(LEVELS[i]); REAL.pend=i;
  rq_('rdC').textContent=k.title; rq_('rdP').textContent=k.place; rq_('rdW').innerHTML='A188 救護車（AVM）<br>控制中心有新任務';
  rq_('rDisp').classList.add('on'); REAL.dispatch=true; vib([80,60,80]); alarm(); }
function realNewJob(i){
  const lv=LEVELS[i]; S.lvl=i; S.level=lv; const k=caseOf(lv); S.kase=k; k.loc=LMK[k.poi]; const L=k.loc;
  if(NEON&&L.stop&&L.patient) NEON.rail.cutPath([L.stop,L.patient],3);
  AE=HOSPS[DEF_H]; S.dest=DEF_H; clearEvents(); REAL.avm=false; rq_('rMis').classList.remove('avm'); rq_('rmS').textContent='緊急輔助醫療救護服務';
  Object.assign(S,{mode:'drive',step:1,leftDepot:true,depotCam:true,equipOk:false,quizOk:false,triageOk:false,stab:100,stabLow:100,quizOpen:false,qDone:[false,false,!k.triage],qScore:0,qPending:0,dashLeft:lv.dash,dashT:14+Math.random()*10,tScene:0,tHosp:0,t0:performance.now()/1000,overT:false});
  setupScene(k,lv);
  patient.visible=true; patient.position.set(L.patient[0],0.3,L.patient[1]); patient.rotation.set(0,Math.random()*6,0);
  patient.userData.blanket.visible=false; patient.userData.p.position.set(0,0.5,1.2); patient.userData.p.rotation.set(-Math.PI/2,0,0);
  bystander.visible=true; bystander.position.set(L.patient[0]+2,0.2,L.patient[1]+1.5);
  setTarget(L.stop); refreshRoute(true); if(routeMesh) routeMesh.visible=true; startLeg(); S.escRoute=null;
  S.noCross=!!(lv.support||lv.escort); peds.forEach(p=>{ if(S.noCross&&p.mode==='cross') placePed(p,S.car.x,S.car.z); });
  if(lv.support) queueSupport(lv.support,true);
  hud('任務：'+k.place,'① 出車 · '+k.title); sirenSet(true); S.sirenUsed=true; toast('控制中心：'+k.call); }
/* ----- 每格 ----- */
function realTick(dt){ if(!REAL.on) return;
  if(REAL.avm&&S.mode==='drive'&&!REAL.dispatch){ REAL.avmT+=dt; if(REAL.jobAt!=null&&REAL.avmT>REAL.jobAt){ REAL.jobAt=null; realOffer(); } }
  { const hideB=S.quizOpen||REAL.dispatch||REAL.avm||S.step>=5||S.mode!=='drive'; rq_('rBars').classList.toggle('hide',hideB);
    rq_('rMis').style.display=REAL.dispatch||S.mode==='map'||S.mode==='result'||S.mode==='over'?'none':'';
    rq_('rTag').classList.toggle('hide',S.mode==='map'||S.mode==='result'); rq_('rAvm').textContent=REAL.avm?'● AVM':''; }
  if(S.mode==='drive'){ REAL.clock+=dt; const r=legLeft(); if(r<15) REAL.stress+=dt*5; REAL.stress-=dt*(S.siren?1.6:1); }
  REAL.stress=Math.max(0,Math.min(100,REAL.stress));
  if((REAL.ht=(REAL.ht||0)-dt)>0) return; REAL.ht=0.25;
  rq_('rmT').textContent=REAL.avm?'返回'+DEPOT_NAME():S.kase?S.kase.title:'--'; rq_('rmP').textContent=$('hTitle').textContent; rq_('rmD').textContent=$('hDist').textContent; rq_('rmL').textContent=REAL.avm?'—':$('hTime').textContent; rq_('rmLl').textContent=REAL.avm?'返站':'限時';
  const m=Math.floor(REAL.clock)%1440; rq_('rClock').textContent='時間：'+String(Math.floor(m/60)).padStart(2,'0')+String(m%60).padStart(2,'0');
  const st=S.stab??100; rq_('rb1').style.width=st+'%'; rq_('rb1t').textContent=st>70?'穩定':st>40?'一般':'危殆';
  const lf=S.legLimit?Math.max(0,legLeft())/S.legLimit:1; rq_('rb2').style.width=(lf*100)+'%'; rq_('rb2t').textContent=lf>0.5?'充足':lf>0.2?'緊張':'告急';
  rq_('rb3').style.width=REAL.stress+'%'; rq_('rb3t').textContent=REAL.stress<35?'低':REAL.stress<70?'中':'高';
  realStars(); }
function realPay(){ const pay=S.stars*400+S.onTime*250+(S.collided?0:300); REAL.cash+=pay; store.set('realCash',REAL.cash); realCash(); return pay; }
/* ----- 撳小地圖：放大地圖 + 暫停 ----- */
const BIGMAP=(()=>{ const d=document.createElement('div'); d.id='bigMap'; d.innerHTML='<div class="bh"><b>🗺️ 地圖 · 已暫停</b><button id="bmX" aria-label="關閉地圖">✕ 繼續</button></div><canvas id="bmC"></canvas><div class="lg"><span><i style="background:#1f4fbf"></i>救護車</span><span><i style="background:#e8323c"></i>目的地</span><span><i style="background:#ff7a1a"></i>路線</span><span>🏥 醫院</span><span>🚑 救護站</span></div>'; document.body.append(d);
  const st=document.createElement('style'); st.textContent=`#mini{pointer-events:auto;cursor:zoom-in}
  #bigMap{position:fixed;inset:0;z-index:60;background:#0b0f16f0;display:none;flex-direction:column;padding:calc(10px + env(safe-area-inset-top)) 10px calc(10px + env(safe-area-inset-bottom));color:#fff;font-family:inherit}
  #bigMap.on{display:flex}#bigMap .bh{display:flex;align-items:center;gap:10px;margin-bottom:8px}#bigMap .bh b{font-size:17px}
  #bmX{margin-left:auto;font:inherit;font-size:16px;font-weight:800;color:#fff;background:#237a3b;border:2px solid #fff6;border-radius:8px;padding:8px 16px}
  #bmC{flex:1;width:100%;min-height:0;border-radius:10px;background:#eef2e8}
  #bigMap .lg{display:flex;flex-wrap:wrap;gap:12px;font-size:12px;margin-top:8px;color:#d9dde3}#bigMap .lg i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px}`; document.head.append(st);
  let t0=0;
  function draw(){ const cv=rq_('bmC'), dpr=Math.min(2,devicePixelRatio||1), W=cv.clientWidth, H=cv.clientHeight; cv.width=W*dpr; cv.height=H*dpr; const g=cv.getContext('2d'); g.scale(dpr,dpr);
    const c=S.car, P=[[c.x,c.z]]; if(S.target) P.push(S.target); if(S.route) S.route.pts.forEach(p=>P.push(p)); P.push(DEPOT.pos);
    let x0=Math.min(...P.map(p=>p[0]))-160, x1=Math.max(...P.map(p=>p[0]))+160, z0=Math.min(...P.map(p=>p[1]))-160, z1=Math.max(...P.map(p=>p[1]))+160;
    const cx=(x0+x1)/2, cz=(z0+z1)/2, sp=Math.max(600,x1-x0,(z1-z0)*W/H); const s=W/sp;   // 每米幾多 px
    const T=(x,z)=>[W/2+(x-cx)*s,H/2+(z-cz)*s];
    g.fillStyle='#eef2e8'; g.fillRect(0,0,W,H); g.imageSmoothingEnabled=true;
    const [ox,oz]=T(BX0-60,BZ0-60); g.drawImage(MM,ox,oz,MM.width/MMS*s,MM.height/MMS*s);
    if(S.route&&S.mode!=='seq'){ g.strokeStyle='#ff7a1a'; g.lineWidth=5; g.lineJoin=g.lineCap='round'; g.beginPath(); g.moveTo(...T(c.x,c.z)); (routeAhead()||[]).forEach((p,k)=>{ if(k) g.lineTo(...T(p[0],p[1])); }); g.stroke(); }
    g.font='20px sans-serif'; g.textAlign='center'; g.textBaseline='middle';
    Object.values(HOSPS).forEach(h=>{ const [a,b]=T(h.door[0],h.door[1]); g.fillText('🏥',a,b); g.font='bold 12px sans-serif'; g.fillStyle='#111'; g.fillText(h.name,a,b+18); g.font='20px sans-serif'; });
    { const [a,b]=T(DEPOT.pos[0],DEPOT.pos[1]); g.fillText('🚑',a,b); g.font='bold 12px sans-serif'; g.fillStyle='#111'; g.fillText(DEPOT_NAME(),a,b+18); }
    if(S.target){ const [a,b]=T(S.target[0],S.target[1]); g.fillStyle='#e8323c'; g.strokeStyle='#fff'; g.lineWidth=3; g.beginPath(); g.arc(a,b,9,0,7); g.fill(); g.stroke(); }
    { const [a,b]=T(c.x,c.z); g.save(); g.translate(a,b); g.rotate(-c.a+Math.PI); g.fillStyle='#1f4fbf'; g.strokeStyle='#fff'; g.lineWidth=2.5; g.beginPath(); g.moveTo(0,-13); g.lineTo(9,9); g.lineTo(0,4); g.lineTo(-9,9); g.closePath(); g.fill(); g.stroke(); g.restore(); }
  }
  function open(){ if(S.mode!=='drive'||REAL.dispatch) return; S.mode='map'; t0=performance.now(); S.hold.L=S.hold.R=S.hold.G=S.hold.B=false; d.classList.add('on'); try{ if(actx) actx.suspend(); }catch(e){} requestAnimationFrame(draw); }
  function close(){ if(S.mode!=='map') return; const p=(performance.now()-t0)/1000; S.legStart+=p; S.t0+=p; S.mode='drive'; d.classList.remove('on'); try{ if(actx) actx.resume(); }catch(e){} clock.getDelta(); }
  $('mini').addEventListener('click',e=>{ e.stopPropagation(); open(); }); rq_('bmX').onclick=close; d.addEventListener('click',e=>{ if(e.target===d) close(); });
  addEventListener('keydown',e=>{ if(e.code==='KeyM'&&!e.repeat){ S.mode==='map'?close():open(); } if(e.code==='Escape') close(); });
  addEventListener('resize',()=>{ if(S.mode==='map') draw(); });
  return {open,close,draw}; })();

/* ---------- 🖥️ 電腦模式：由寫實模式再開發 ----------
   GTA 式畫面（香港日頭／夜景兩套調色、玻璃反光、光暈、電影調色）、細操作掣、字幕喺救護車下面、
   滑鼠拖曳轉鏡頭、滾輪縮放、鍵盤快捷鍵。派遣、AVM、計分照用寫實模式。要配合「電腦」畫質（GFX 3）。 */
/* 香港日頭：清爽藍天、暖陽、少少煙霞；香港夜景：霓虹藍紫氛圍＋黃色鈉燈街燈 */
TOD.pcday={sky:0x8fc0ea,hemi:[0xeaf3ff,0x8a8070,0.46],sun:[0xffe6c0,1.25],fog:[230,640],cloud:0xffffff,pc:'day'};
TOD.pcnight={sky:0x100d2c,hemi:[0x6c5cf0,0x120e22,0.34],sun:[0x8078ff,0.16],fog:[150,520],cloud:0x2c2552,night:true,pc:'night'};
TOD.pcdusk=TOD.pcnight; TOD.pcreal=TOD.pcnight;
TOD.pcrain={sky:0x1d1d3e,hemi:[0x7066d8,0x1a1830,0.46],sun:[0x8a88d8,0.18],fog:[90,360],cloud:0x3a3660,night:true,wet:true,pc:'night'};
const PC=(()=>{
  if(GFX>=3){ sun.shadow.mapSize.set(2048,2048); }
  const P={on:false,zoom:store.get('pcZoom',1),bars:store.get('pcBars',false),env:{}};
  /* ----- 天空：日間由地平線白霞到頂部深藍；夜晚地平線紫紅霓虹光到頂部深靛 ----- */
  const sky=(()=>{ const g=new THREE.SphereGeometry(420,32,16); const col=new Float32Array(g.attributes.position.count*3); g.setAttribute('color',new THREE.BufferAttribute(col,3));
    const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false,toneMapped:false})); m.renderOrder=-10; m.visible=false; m.frustumCulled=false; scene.add(m); return m; })();
  const SKY={day:[0xe4edf2,0xa9cdee,0x4f8fdc],night:[0x6a2f8a,0x2a1d5c,0x07081c]};
  function paintSky(k){ const [h,mi,t]=SKY[k].map(c=>new THREE.Color(c)), P_=sky.geometry.attributes.position, C=sky.geometry.attributes.color, c=new THREE.Color();
    for(let i=0;i<P_.count;i++){ const y=P_.getY(i)/420; if(y<0.06) c.copy(h).lerp(mi,Math.max(0,y)/0.06); else if(y<0.4) c.copy(mi).lerp(t,(y-0.06)/0.34); else c.copy(t); if(y<0) c.copy(h).multiplyScalar(k==='night'?0.5:0.85); C.setXYZ(i,c.r,c.g,c.b); }
    C.needsUpdate=true; }
  /* ----- 反光環境圖（玻璃幕牆用）：天空漸變＋遠處一排排光 ----- */
  function envFor(k){ if(P.env[k]) return P.env[k]; const es=new THREE.Scene(); const g=new THREE.SphereGeometry(50,32,16), col=[], p=g.attributes.position, c=new THREE.Color();
    const [h,mi,t]=SKY[k].map(x=>new THREE.Color(x)), gr=new THREE.Color(k==='night'?0x0b0a18:0x5d6168);
    for(let i=0;i<p.count;i++){ const y=p.getY(i)/50; if(y<0) c.copy(gr); else if(y<0.08) c.copy(h).lerp(mi,y/0.08); else c.copy(mi).lerp(t,Math.min(1,(y-0.08)/0.4)); col.push(c.r,c.g,c.b); }
    g.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); es.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide})));
    const bm=new THREE.MeshBasicMaterial({color:k==='night'?0x1a1838:0x8b939c});
    for(let i=0;i<40;i++){ const a=i/40*Math.PI*2, r=40, h2=4+Math.random()*16; const b=new THREE.Mesh(new THREE.BoxGeometry(5+Math.random()*5,h2,5),bm); b.position.set(Math.cos(a)*r,h2/2-1,Math.sin(a)*r); b.lookAt(0,h2/2-1,0); es.add(b);
      if(k==='night') for(let j=0;j<5;j++){ const l=new THREE.Mesh(new THREE.PlaneGeometry(0.8,0.5),new THREE.MeshBasicMaterial({color:[0xffd28a,0x8fd0ff,0xff6ad5,0x6a7dff][j%4]})); l.position.copy(b.position).multiplyScalar(0.93); l.position.y=1+Math.random()*h2*0.9; l.lookAt(0,l.position.y,0); es.add(l); } }
    if(k==='day'){ const s=new THREE.Mesh(new THREE.SphereGeometry(3,12,8),new THREE.MeshBasicMaterial({color:0xfff4dc})); s.position.set(25,30,-20); es.add(s); }
    const pm=new THREE.PMREMGenerator(R); const rt=pm.fromScene(es,0.02); pm.dispose(); return P.env[k]=rt.texture; }
  /* ----- 調色：電影感 tone curve、飽和、日間暖陽／夜晚藍紫、暗角 ----- */
  const GR={uniforms:{tDiffuse:{value:null},time:{value:0},night:{value:0}},
    vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader:`uniform sampler2D tDiffuse; uniform float time; uniform float night; varying vec2 vUv;
      vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
      void main(){ vec2 d=vUv-0.5; float r=dot(d,d); float ca=0.0018*r;
        vec3 col=vec3(texture2D(tDiffuse,vUv+d*ca).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-d*ca).b);
        col=mix(col,aces(col*1.25),0.75);
        float l=dot(col,vec3(0.299,0.587,0.114));
        vec3 sh=mix(vec3(0.94,0.98,1.06),vec3(0.86,0.8,1.16),night), hi=mix(vec3(1.06,1.02,0.92),vec3(1.08,0.98,0.86),night);
        col=mix(col*sh,col,smoothstep(0.0,0.6,l)); col=mix(col,col*hi,smoothstep(0.4,1.0,l)*0.7);
        col=mix(vec3(l),col,mix(1.14,1.2,night)); col=(col-0.5)*mix(1.06,1.1,night)+0.5;
        col*=1.0-smoothstep(0.25,0.75,r*1.6)*mix(0.22,0.36,night);
        float n=fract(sin(dot(vUv*vec2(12.9898,78.233)+time,vec2(1.0)))*43758.5453); col+=(n-0.5)*0.01;
        gl_FragColor=vec4(clamp(col,0.0,1.0),1.0); }`};
  function comp(){ if(P.comp) return P.comp; const C=new THREE.EffectComposer(R); C.addPass(new THREE.RenderPass(scene,cam));
    const bloom=new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth/2,innerHeight/2),0.3,0.5,0.9); C.addPass(bloom); const gp=new THREE.ShaderPass(GR); C.addPass(gp);
    if(C.setPixelRatio) C.setPixelRatio(R.getPixelRatio());
    addEventListener('resize',()=>{ C.setSize(innerWidth,innerHeight); bloom.setSize(innerWidth/2,innerHeight/2); }); P.bloom=bloom; P.gp=gp; return P.comp=C; }
  /* ----- 街燈：夜晚轉黃色鈉燈 ----- */
  const LH=typeof LAMPHEAD!=='undefined'?LAMPHEAD:null; const LH0=LH?[LH.color.getHex(),LH.emissive.getHex()]:null;
  function palette(T){ const k=T.pc||'day', night=k==='night'; sky.visible=P.on; paintSky(k); scene.background.setHex(night?0x100d2c:0x9cc6ec);
    if(PCB) PCB.setEnv(envFor(k),night,!!T.wet);
    const LP=NEON&&NEON.lampp; if(LP){ LP.mat.color.setHex(night?0xffa63a:0xffffff); LP.mat.opacity=night?(T.wet?0.75:0.95):0.4; }
    if(LH){ LH.color.setHex(night?0xffd08a:LH0[0]); LH.emissive.setHex(night?0xff9a28:LH0[1]); }
    if(P.bloom){ P.bloom.strength=night?0.62:0.2; P.bloom.threshold=night?0.74:0.92; P.bloom.radius=night?0.5:0.4; } GR.uniforms.night.value=night?1:0; P.night=night; }
  function restore(){ sky.visible=false; if(PCB) PCB.setEnv(null,false); const LP=NEON&&NEON.lampp; if(LP) LP.mat.color.setHex(0xffffff); if(LH){ LH.color.setHex(LH0[0]); LH.emissive.setHex(LH0[1]); } }
  /* ----- 介面 ----- */
  const st=document.createElement('style'); st.textContent=`
  body.pc .btns{transform:scale(.62);transform-origin:bottom right;left:auto;right:10px;width:330px}
  body.pc .btns .lr{transform-origin:bottom left}
  body.pc #bMenu,body.pc #bAEB{top:calc(12px + env(safe-area-inset-top))!important;right:auto!important;left:12px!important;background:#0b0e14b8!important;color:#e8edf3!important;border-radius:4px!important;font-size:11px!important;padding:5px 9px!important;box-shadow:none!important}
  body.pc #bAEB{left:70px!important}
  body.pc #mini{left:18px!important;bottom:calc(50px + env(safe-area-inset-bottom))!important;width:176px!important;height:176px!important;border:3px solid #0d1118!important;outline:3px solid #ffffff22;box-shadow:0 6px 24px #000a!important}
  body.pc #rTR{left:18px;right:auto;top:auto!important;bottom:calc(14px + env(safe-area-inset-bottom));text-align:left;display:flex;gap:10px;align-items:center}
  body.pc #rlStars{justify-content:flex-start}body.pc #rClock{margin:0;font-size:13px;background:#0d1118cc}
  body.pc #rMis{left:auto;right:14px;top:calc(14px + env(safe-area-inset-top));max-width:300px;background:#0b0e14c8;border:1px solid #ffffff1a;border-radius:6px;backdrop-filter:blur(6px)}
  body.pc #rMis .ic{border-radius:4px}body.pc #rMis b{font-size:13px}body.pc #rMis span{font-size:11.5px}
  body.pc .rb div{border-color:#ffffff44;border-radius:2px;height:6px}body.pc .rb u{background:linear-gradient(90deg,#ff4d3d,#ffb347)}
  body.pc #rDisp{left:22px;top:auto;bottom:calc(250px + env(safe-area-inset-bottom));max-width:330px;background:#0b0e14e0;border-radius:6px;border-left:4px solid #ffcf5a;backdrop-filter:blur(6px)}
  body.pc #rDisp .bt button{font-size:17px;border-radius:4px;padding:6px 0}body.pc #rDisp .bl span:first-child::before{content:'Enter · '}body.pc #rDisp .bl span:last-child::before{content:'Backspace · '}
  /* 字幕：救護車下面 */
  body.pc #toast,body.pc #cap,body.pc #radio{position:fixed;left:var(--sx,50%)!important;right:auto!important;bottom:auto!important;transform:translateX(-50%)!important;max-width:min(640px,80vw)!important;text-align:center;z-index:24}
  body.pc #radio{top:calc(var(--sy,70%) + 14px)!important;background:#000000a8!important;border:none!important;color:#fff!important;border-radius:4px!important;font-size:calc(15px * var(--fz,1))!important;padding:6px 14px!important;transition:opacity .25s}
  body.pc #radio b{color:#7dd3fc;margin-right:6px}
  body.pc #toast{top:calc(var(--sy,70%) + 58px)!important;background:none!important;color:#fff!important;font-size:calc(17px * var(--fz,1))!important;font-weight:800!important;text-shadow:0 0 3px #000,0 2px 5px #000,0 0 12px #000!important;white-space:normal!important;box-shadow:none!important;padding:2px 8px!important}
  body.pc #toast .pcw{color:#ffcf5a}
  body.pc #cap{top:calc(var(--sy,70%) + 96px)!important;background:#000000a0!important;border-radius:4px!important;font-size:calc(15px * var(--fz,1))!important;padding:6px 14px!important}
  /* 小測、裝備：深色半透明 */
  body.pc .sheet .panel{background:#0b0e14ec;color:#eef2f7;border:1px solid #ffffff1f;border-radius:8px;max-width:600px;backdrop-filter:blur(8px)}
  body.pc #qText{color:#fff}body.pc .qo{background:#ffffff0d;border:1px solid #ffffff26;color:#eef2f7;border-radius:6px;counter-increment:qo}
  body.pc #qOpts{counter-reset:qo}body.pc .qo::before{content:counter(qo);display:inline-block;min-width:20px;margin-right:8px;padding:1px 5px;border:1px solid #ffffff55;border-radius:3px;font-size:12px;text-align:center;color:#ffcf5a}
  body.pc .qo:disabled{color:#cfd5dd}body.pc .qo.ok{background:#16a34a33;border-color:#4ade80}body.pc .qo.bad{background:#dc262633;border-color:#f87171}body.pc #qWhy{color:#cfd5dd}
  #pcKeys{display:none;position:fixed;left:50%;bottom:calc(8px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:7;font-size:11.5px;color:#e8edf3cc;background:#0b0e14a0;border-radius:4px;padding:4px 10px;white-space:nowrap;pointer-events:none}
  #pcKeys kbd{font:inherit;font-weight:800;color:#fff;border:1px solid #ffffff55;border-radius:3px;padding:0 4px;margin:0 2px}
  body.pc.pcDrive #pcKeys{display:block}
  #pcBars{display:none;position:fixed;inset:0;pointer-events:none;z-index:5}#pcBars::before,#pcBars::after{content:'';position:absolute;left:0;right:0;height:6.5vh;background:#000}#pcBars::before{top:0}#pcBars::after{bottom:0}
  body.pc.pcLB #pcBars{display:block}
  @media (max-width:820px){ #pcKeys{display:none!important} }`; document.head.append(st);
  const keys=document.createElement('div'); keys.id='pcKeys'; keys.innerHTML='<kbd>W</kbd><kbd>↑</kbd>油　<kbd>S</kbd><kbd>↓</kbd>倒車　<kbd>A</kbd><kbd>D</kbd>轉彎　<kbd>H</kbd>警號　<kbd>M</kbd>地圖　<kbd>V</kbd>視線　<kbd>Esc</kbd>選單　滑鼠拖曳 轉鏡頭　滾輪 縮放'; document.body.append(keys);
  const bars=document.createElement('div'); bars.id='pcBars'; document.body.append(bars);
  // 字幕：講嘢嘅人（「控制中心：」）用黃色
  const T_=$('toast'); new MutationObserver(()=>{ const t=T_.textContent; if(!P.on||T_.dataset.pc===t) return; const i=t.indexOf('：'); if(i>0&&i<8){ T_.dataset.pc=t; T_.innerHTML='<span><b class="pcw">'+t.slice(0,i+1)+'</b>'+t.slice(i+1).replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c])); } }).observe(T_,{childList:true,characterData:true,subtree:true});
  /* ----- 滾輪縮放 ----- */
  R.domElement.addEventListener('wheel',e=>{ if(!P.on) return; e.preventDefault(); P.zoom=Math.max(0.55,Math.min(1.8,P.zoom*(e.deltaY>0?1.08:1/1.08))); store.set('pcZoom',P.zoom); },{passive:false});
  /* ----- 鍵盤 ----- */
  addEventListener('keydown',e=>{ if(!P.on||typing(e)) return;
    if(S.quizOpen&&/^Digit[1-6]$/.test(e.code)){ const b=document.querySelectorAll('#qOpts .qo')[+e.code.slice(5)-1]; if(b&&!b.disabled){ b.click(); e.preventDefault(); } return; }
    if(e.code==='Enter'||e.code==='NumpadEnter'){ const qn=$('qNext'); if(S.quizOpen&&qn&&qn.style.display!=='none'&&qn.offsetParent){ qn.click(); e.preventDefault(); return; } if(REAL.dispatch){ rq_('rRes').click(); e.preventDefault(); } return; }
    if(e.code==='Backspace'&&REAL.dispatch){ rq_('rRej').click(); e.preventDefault(); return; }
    if(e.code==='Escape'&&S.mode==='drive'&&!e.repeat){ $('bMenu').click(); } });
  /* ----- 開／關 ----- */
  function begin(on){ P.on=!!on; S.pcOn=P.on; document.body.classList.toggle('pc',P.on); document.body.classList.toggle('pcLB',P.on&&P.bars);
    if(!P.on){ document.body.classList.remove('pcDrive'); if(P.saved){ REAL.comp=P.saved[0]; REAL.gp=P.saved[1]; REAL.bloom=P.saved[2]; P.saved=null; } restore(); return; }
    const C=comp(); if(!P.saved) P.saved=[REAL.comp,REAL.gp,REAL.bloom]; REAL.comp=C; REAL.gp=P.gp; REAL.bloom=P.bloom; REAL.fx=true; realSky.visible=false;
    setTOD(S.level.tod==='dusk'?'dusk':S.level.tod); }
  const v=new THREE.Vector3();
  function tick(dt,t){ if(!P.on) return; if(PCB) PCB.tick(t); sky.position.copy(cam.position);
    document.body.classList.toggle('pcDrive',S.mode==='drive');
    v.set(S.car.x,ELEV(S.car.x,S.car.z)+0.2,S.car.z).project(cam); let sx=(v.x*0.5+0.5)*innerWidth, sy=(-v.y*0.5+0.5)*innerHeight; if(v.z>1){ sx=innerWidth/2; sy=innerHeight*0.7; }
    sx=Math.max(innerWidth*0.3,Math.min(innerWidth*0.7,sx)); sy=Math.max(innerHeight*0.45,Math.min(innerHeight-190,sy));
    const b=document.body.style; if(Math.abs((P.sx||0)-sx)>1) { b.setProperty('--sx',sx.toFixed(0)+'px'); P.sx=sx; } if(Math.abs((P.sy||0)-sy)>1){ b.setProperty('--sy',sy.toFixed(0)+'px'); P.sy=sy; } }
  S.pcHook=begin; S.pcPal=palette;
  return Object.assign(P,{begin,tick,palette,setBars(on){ P.bars=!!on; store.set('pcBars',P.bars); document.body.classList.toggle('pcLB',P.on&&P.bars); }}); })();
window.__PC=PC;

/* ---------- 🩺 現場模擬關卡：每個 protocol 一關，每次隨機抽一個規程分支（資料來源：ems.homes） ---------- */
const SIMLV=(()=>{
  const HOSP=()=>(typeof REGION!=='undefined'&&REGION!=='tm')?'威爾斯親王醫院':'屯門醫院';
  const pk=a=>a[Math.random()*a.length|0];
  const sh=a=>{ const b=a.slice(); for(let i=b.length-1;i>0;i--){ const j=Math.random()*(i+1)|0; [b[i],b[j]]=[b[j],b[i]]; } return b; };
  const S=(k,act,find,q,o,why,x)=>Object.assign({k,act,find,q:{q,o,a:0,why}},x||{});
  const AV=['A 清醒','V 對說話有反應','P 對痛楚有反應','U 冇反應'];
  const O2O={room:'室內空氣 (Room Air)，每兩分鐘監察 SpO₂',nc:'鼻插喉／簡單面罩，維持 SpO₂ ≥ 94%',nrm:'不能回吸面罩 (NRM) 15 L 高濃度氧氣',bvm:'膠囊活門面罩 (BVM) 輔助通氣，15 L 氧氣',ven:'文氏面罩，由 FiO₂ 0.24 @ 3 L 開始',none:'暫時唔俾氧，每兩分鐘監察 SpO₂'};
  const O2W={room:'第 4 類一般病人：SpO₂ ≥ 94% 而冇呼吸困難 → Room Air，每兩分鐘監察。',nc:'第 4 類一般病人：SpO₂ 85–93%（或 ≥ 94% 但有呼吸困難）→ 鼻插喉／簡單面罩，維持 SpO₂ ≥ 94%。',nrm:'嚴重受傷或罹患危疾（休克、重大創傷、頭部重創、過敏反應、全身抽搐、一氧化碳中毒、吸入性損傷等）→ 不能回吸面罩／BVM 高濃度氧氣。',bvm:'呼吸驟停或呼吸率及／或深度不足 → 用膠囊活門面罩 (BVM)。',ven:'COPD 有呼吸困難 → 文氏面罩程序：由 0.24／3 L 開始，目標 SpO₂ 90–94%，每兩分鐘監察。',none:'攝取百草枯：SpO₂ ≥ 85% 唔應俾氧，每兩分鐘監測；< 85% 先俾最低量氧氣，目標 85–88%。'};
  function BB(o){ const s=[];
    s.push(o.rseQ?Object.assign({k:'RSE',act:o.rseAct||'觀察環境、留意致傷過程 (MOI)、自我介紹',find:o.rse},{q:o.rseQ}):S('RSE',o.rseAct||'觀察環境、留意致傷過程 (MOI)、自我介紹',o.rse,'到場第一步要確認咩？',['現場安全 (RSE)，留意致傷過程 (MOI)','即刻俾氧氣','先量血壓','先問病史'],'流程由 RSE 開始：先確保現場安全，再接觸病人。'));
    const [a,lf]=o.loc; s.push(S('LOC','叫病人、問「剛才發生咩事？」；冇反應就輕壓肩斜肌',lf,'AVPU 評級係？',[AV[a],...AV.filter((_,i)=>i!==a)],'A 清醒、V 對說話有反應、P 對痛楚有反應、U 完全冇反應。',{reveal:['avpu']}));
    const [dn,df]=o.d; s.push(S('D','問有冇跌倒、撞傷頭頸、頸痛、能否自己坐起',df,'脊椎 (D) 點處理？',dn?['懷疑脊椎受損：隊員用頭鎖固定頭部，再按脊柱處理準則評估','Rule out D，唔使理','叫病人自己行幾步試吓','郁吓條頸睇吓痛唔痛']:['Rule out D，唔使固定頭部','隊員用頭鎖固定頭部','即刻上頸套同脊椎板','叫病人瞓低唔好郁'],dn?'懷疑脊椎受損 → 隊員用頭鎖固定頭部，氣道用 Modified jaw thrust；之後按 Spinal Management（經改良 NEXUS 準則）決定制動。':'冇跌倒、冇撞傷、冇頸痛、可以自己坐起 → Rule out D。'));
    s.push(o.cabQ?{k:'CAB',act:'摸脈搏、睇氣道、視聽觸呼吸',find:o.cab,reveal:['hr','rr'],q:o.cabQ,set:o.cabSet}:S('CAB','摸脈搏、睇氣道、視聽觸呼吸',o.cab,'摸到橈動脈脈搏，大約表示上壓 ≥ 幾多？',['80 mmHg','60 mmHg','70 mmHg','100 mmHg'],'Radial ≥ 80、Femoral ≥ 70、Carotid ≥ 60；冇脈搏即 CPR。',{reveal:['hr','rr']}));
    const [c,of,sp]=o.o2; const wr=sh(Object.keys(O2O).filter(k=>k!==c&&!(c==='nrm'&&k==='bvm')&&!(c==='bvm'&&k==='nrm'))).slice(0,3);
    s.push(S('O2','夾 SpO₂，按氧氣治療規程',of,'應該點俾氧？',[O2O[c],...wr.map(k=>O2O[k])],O2W[c],{reveal:['spo2'],set:sp?{spo2:sp}:null}));
    s.push(o.rbsQ?{k:'RBS',act:'快速檢查頭、頸、胸、腹、髖、背、下肢、上肢',find:o.rbs,q:o.rbsQ,set:o.rbsSet}:S('RBS','快速檢查頭、頸、胸、腹、髖、背、下肢、上肢（約 30 秒）',o.rbs,'快速檢查 (RBS) 嘅次序係？',['頭、頸、胸、腹、髖、背、下肢、上肢','上肢、下肢、頭、胸','胸、腹、頭、頸','只檢查痛嘅位置'],'約 30 秒，展露傷處盡快處理。'));
    s.push(o.skinQ?{k:'SKIN',act:'睇皮膚顏色、摸溫度同濕度',find:o.skin,q:o.skinQ}:o.shock?S('SKIN','睇皮膚顏色、摸溫度同濕度',o.skin,'皮膚蒼白濕冷提示？',['可能有休克，要密切留意','正常','發燒','曬傷'],'休克徵狀：Pale、cool、clammy（蒼白、冷、濕）。'):S('SKIN','睇皮膚顏色、摸溫度同濕度',o.skin,'皮膚檢查要睇咩？',['顏色（蒼白、潮紅、發紺）、濕／乾、冷／暖','只睇有冇紋身','只睇有冇疤痕','唔使睇'],'正常係「Pink, warm, dry」。'));
    const [u,dx,dw]=o.dec; s.push(S('DEC','決定：穩定定不穩定',dx,'病人情況屬於？',u?['不穩定 (Unstable)：盡快處理及送院','穩定 (Stable)：喺現場詳細檢查先決定']:['穩定 (Stable)：可以喺現場進一步檢查','不穩定：即刻送院、唔使處理'],dw||(u?'不穩定：清醒程度下降、呼吸 < 10 或 > 29、休克徵狀、胸痛、新出現發紺等。':'冇威脅生命嘅情況 → 穩定，可以喺現場進一步檢查同處理。')));
    return s; }
  const VS=(f,x)=>S('VS','量維生指數',f,'不穩定病人幾耐量一次維生指數？',['每 5 分鐘 (Q5)','每 15 分鐘','每 30 分鐘','到醫院先量'],'不穩定病人 Q5、穩定病人 Q15。',Object.assign({reveal:['sbp','hr','rr','spo2']},x||{}));
  const VS2=(f,x)=>S('VS','量維生指數',f,'行到 Protocol（不穩定）嘅病人幾耐量一次維生指數？',['每 5 分鐘 (Q5)','每 15 分鐘','每小時','唔使量'],'行到 Protocol 嘅病人屬不穩定：Q5；冇生命危險嘅穩定病人先係 Q15。',Object.assign({reveal:['sbp','hr','rr','spo2']},x||{}));
  const LG=(f,q,o,w,x)=>S('LG','LOAD & GO：上車床送院',f,q||'下一步？',o||['LOAD & GO，送院途中繼續密切觀察','留喺現場等病人完全好返','叫病人自己去醫院','等家人到咗先走'],w||'處理好即時問題後 LOAD & GO，途中繼續密切觀察。',x);
  const H=(re,m)=>[...(re?[re]:[]),{k:'MIST',act:'向急症室交接',mist:m}];
  const ARR=(rse,cpr,aed)=>[S('RSE','觀察環境、確保安全',rse,'到場見病人倒地，第一步？',['確保現場安全，再接觸病人','即刻開始 CPR 唔使理環境','先搵病人身份證','先問旁人病歷'],'RSE 先：確保自己同其他人安全。'),
    S('LOC','拍膊頭、大聲叫、輕壓肩斜肌','對聲音同痛楚都冇反應。','AVPU 評級係？',['U 冇反應','P','V','A'],'完全冇反應 = U。',{reveal:['avpu']}),
    S('CAB','同時檢查脈搏同呼吸（唔多過 10 秒）','頸動脈摸唔到脈搏，冇呼吸（間中有瀕死呼吸 Gasping）。','即刻要做咩？',['立即施行 CPR（≥ 8 歲 30:2），儘快接駁 AED','先俾氧觀察 5 分鐘','先量血壓','擺復原臥式'],'發現冇呼吸脈搏 → 立即 CPR；瀕死呼吸當冇呼吸。',{reveal:['hr','rr']}),...(cpr||[]),...(aed||[])];
  const L=[];
  /* ================= 用藥 Protocol ================= */
  L.push({id:'chest',ic:'❤️',cat:'藥',title:'心源性胸部痛',en:'Cardiac Chest Pain',
    vars:[{k:'ntg',label:'有處方 NTG、血壓足夠'},{k:'nontg',label:'冇處方 NTG → 痛未止用 Penthrox'},{k:'lowbp',label:'SBP < 100 → 唔可以俾 NTG'},{k:'asa24',label:'24 小時內已服 ASA'}],
    make(v){ const sbp=v.k==='lowbp'?94:138; return {who:'62 歲男子',call:'有 62 歲男子胸口痛、出冷汗，佢話以前有心臟病。',v:{hr:96,sbp,dbp:v.k==='lowbp'?60:86,rr:22,spo2:92,avpu:0,gcs:15,rbs:6.8,pain:8,rhythm:'sinus'},
      steps:[...BB({rse:'大堂環境安全。男子坐喺櫈度，手按住胸口，額頭冒汗。',loc:[0,'對答清楚：「胸口好翳……好似有嘢壓住。」'],d:[0,'冇跌倒、冇撞傷、冇頸痛，自己坐得穩。'],cab:'橈動脈有脈，約 96 次、規則；氣道暢通；呼吸 22 次。',o2:['nc','SpO₂ 92%，冇 COPD、冇食百草枯，輕微氣促。',96],rbs:'冇明顯傷勢。',skin:'蒼白、濕冷。',shock:1,dec:[1,'清醒，但有胸痛、皮膚濕冷。','有胸痛（懷疑心臟病發）屬情況不穩定。']}),
        S('HX','問 OPQRST 同 Critical Hx','O：20 分鐘前行樓梯開始 · P：休息都唔減 · Q：好似重物壓住 · R：胸口中間，傳去左手 · S：8／10 · T：持續。'+(v.k==='nontg'?'冇醫生處方 NTG。':'有心臟病，醫生處方 NTG（Isordil）。')+(v.k==='asa24'?'今朝已經自己食咗一粒阿士匹靈。':'今日未食阿士匹靈。')+'冇藥物敏感、一星期內冇做手術、72 小時內冇用壯陽藥。','問胸口痛用嘅口訣係？',['OPQRST','MIAMIA','CHEAP PAIN','3N'],'OPQRST：Onset、Provocation／palliation、Quality、Region／radiation、Severity、Time。',{reveal:['pain']}),
        VS(`BP ${sbp}／${v.k==='lowbp'?60:86} · HR 96 · RR 22 · SpO₂ 96%`),
        v.k==='asa24'?S('TX','ASA：確認適用症、排除禁忌症 (SAPHBUS)','24 小時內已因今次不適服用 ASA。','點處理？',['唔使再俾 ASA（SAPHBUS 嘅 U：Used）','再俾 200 mg','俾 100 mg 補足','俾 400 mg'],'如病人 24 小時內曾因今次心臟不適服用 ASA（自服、醫生或 PAD 指示），救護人員唔需要再俾。')
          :S('TX','ASA：確認適用症、排除禁忌症 (SAPHBUS)','懷疑心源性胸痛、≥ 12 歲；冇 SAPHBUS 任何一項。','ASA（阿士匹靈）點俾？',['200 mg，只俾一劑','100 mg，每 5 分鐘一劑','唔可以俾：佢有心臟病','400 mg'],'ASA 200 mg，Only One Dose。禁忌 SAPHBUS：吞嚥、< 12 歲、懷孕、過敏、出血、24 小時內已服、一星期內手術；LVAD 亦唔可以。',{e:{q:'救護員會俾胸口痛病人咀嚼咩藥？',o:['阿士匹靈 (Aspirin)','止咳水','維他命 C'],a:0,why:'懷疑心臟引致嘅胸口痛，冇禁忌就俾阿士匹靈 200 mg。'}}),
        v.k==='ntg'||v.k==='asa24'?S('TX','NTG：睇處方同維生指數',`有醫生處方 NTG；SBP ${sbp}、HR 96；冇 LVAD。`,'NTG 點處理？',['SBP ≥ 100、HR ≤ 150 → 0.4 mg 一噴','唔可以：SBP 要 ≥ 140','一次過噴 3 下','已經俾咗 ASA 就唔可以俾'],'NTG 0.4 mg／噴，最多 3 噴，每劑相隔 5 分鐘；SBP ≥ 100、HR ≤ 150。',{set:{pain:6,sbp:126,hr:92}})
        :v.k==='lowbp'?S('TX','NTG：睇處方同維生指數','有醫生處方 NTG，但 SBP 94。','NTG 點處理？',['唔可以俾：收縮壓 < 100','可以俾 0.4 mg','俾半劑','先俾 NS 再噴'],'NTG 禁忌：SBP < 100、HR > 150、對 NTG 過敏、72 小時內用過壯陽藥、LVAD。')
        :S('TX','NTG：睇處方','冇醫生處方 NTG。','NTG 點處理？',['唔可以俾：冇醫生處方 NTG','可以俾 0.4 mg','俾 3 噴','問家人借'],'NTG 適用症要病人有醫生處方嘅 NTG／Nitrates。'),
        S('TX','其他檢查','情況許可。','情況許可時，應同時做咩檢查？',['12 導聯心電圖 (12-Lead ECG)','量體溫','驗尿','唔使'],'心源性胸痛規程：如情況許可，同時進行 12-Lead ECG。'),
        LG('病人用車床上車。',null,['LOAD & GO，途中繼續觀察，需要時再按規程處理','留喺現場等痛完全消失','叫病人自己行上車','等家人到咗先走'])],
      hosp:H(v.k==='ntg'||v.k==='asa24'?S('RE','第一劑 NTG 後 5 分鐘重新評估','仍然胸痛 6／10 · BP 124／80 · HR 90','點處理？',['相隔 5 分鐘、SBP ≥ 100、HR ≤ 150 → 第 2 劑 NTG 0.4 mg','停止所有用藥','再俾 ASA 200 mg','一次過噴 3 下'],'仍有胸痛及 SBP ≥ 100、HR ≤ 150：相隔 5 分鐘俾第 2／3 劑 NTG。',{set:{pain:4,sbp:120,hr:86}})
        :S('RE','途中重新評估','仍然胸痛 7／10；冇 NTG 可用。','點處理？',['密切觀察，嘗試使用 Penthrox（綠哨子）','俾 NTG','再俾 ASA','唔使理'],'已用盡劑量或冇處方 NTG → 密切觀察病人，嘗試使用 Penthrox。',{set:{pain:4}}),
        ['62 歲男，20 分鐘前行樓梯開始胸口痛，有心臟病','胸口中間壓住感傳去左手，皮膚蒼白濕冷','BP '+sbp+' → '+(v.k==='lowbp'?'96':'120')+' · HR 96 → 86 · SpO₂ 92% → 97%',v.k==='asa24'?'氧氣、（已自服 ASA）、NTG × 2、12 導聯心電圖':v.k==='ntg'?'氧氣、ASA 200 mg、NTG 0.4 mg × 2、12 導聯心電圖':'氧氣、ASA 200 mg、Penthrox、12 導聯心電圖'])}; } });
  L.push({id:'resp',ic:'🫁',cat:'藥',title:'呼吸（氣促）',en:'Respiratory',
    vars:[{k:'asthma',label:'哮喘成人'},{k:'copd',label:'COPD → 文氏面罩'},{k:'preg',label:'懷孕 → 唔可以用 Atrovent'},{k:'child',label:'8 歲小童'},{k:'glau',label:'有青光眼病歷（冇急性發作）'}],
    make(v){ const child=v.k==='child', age=child?'8 歲男童':v.k==='copd'?'72 歲男子':v.k==='preg'?'30 歲孕婦':'35 歲女子';
      return {who:age,call:'有'+age+'氣促、講嘢斷斷續續。',v:{hr:114,sbp:128,dbp:80,rr:30,spo2:v.k==='copd'?86:90,avpu:0,gcs:15,rbs:6,pain:0,rhythm:'tachy'},
      steps:[...BB({rse:'住宅單位，環境安全。病人坐喺床邊、身向前傾，用力呼吸。',loc:[0,'清醒，講嘢斷斷續續。'],d:[0,'冇跌倒、冇撞傷。'],cab:'橈動脈 114 次；氣道暢通；呼吸 30 次，有喘鳴、用輔助肌。',o2:v.k==='copd'?['ven','SpO₂ 86%，有 COPD 病歷，呼吸困難。',90]:['nc','SpO₂ 90%，冇 COPD，呼吸困難。',94],rbs:'冇傷勢。',skin:'冒汗、嘴唇稍為發紺。',skinQ:{q:'嘴唇發紺代表？',o:['缺氧','發燒','過敏','正常'],a:0,why:'新出現嘅發紺屬情況不穩定。'},dec:[1,'呼吸 30 次、SpO₂ 偏低。','呼吸每分鐘 > 29、新出現發紺屬不穩定。']}),
        S('HX','問 Critical Hx',(v.k==='copd'?'有 COPD，用開 Ventolin、Atrovent。':child?'有哮喘，用開 Ventolin。':'有哮喘，醫生處方 Ventolin。')+(v.k==='preg'?'懷孕 28 星期。':'')+(v.k==='glau'?'有青光眼病歷，而家冇眼痛、視力正常。':'')+'對 Ventolin 冇敏感。','Ventolin／Atrovent 適用症包括？',['主要不適為氣促，有哮喘／COPD 病歷或處方 Beta2-agonist 等','任何咳嗽病人','只限 COPD','只限 65 歲以上'],'適用症：主要不適為氣促，而有哮喘／COPD 病歷、或處方 Beta2-agonist／Anti-cholinergic、或曝露於不明氣體引致下支氣管收窄（需先聽肺）。'),
        VS('BP 128／80 · HR 114 · RR 30 · SpO₂ '+(v.k==='copd'?'90%':'94%')+'；聽肺音（前後）有喘鳴'),
        S('TX','Salbutamol (Ventolin)',(child?'8 歲':'成人')+'，聽肺確認下支氣管收窄。','Ventolin 劑量？',child?['300 mcg（3 puffs）','400 mcg（4 puffs）','200 mcg（2 puffs）','唔可以俾']:['400 mcg（4 puffs）','300 mcg（3 puffs）','200 mcg（2 puffs）','100 mcg（1 puff）'],'Salbutamol：2 至 < 5 歲 200 mcg（2 puffs）、5 至 < 12 歲 300 mcg（3 puffs）、≥ 12 歲 400 mcg（4 puffs）。',{set:{rr:26,spo2:v.k==='copd'?91:95}}),
        child?S('TX','Ipratropium Bromide (Atrovent)','8 歲。','Atrovent 可唔可以俾？',['唔可以：< 12 歲係禁忌','可以 40 mcg','可以 20 mcg','可以 80 mcg'],'Atrovent 禁忌：< 12 歲、對 Ipratropium／Atropine 敏感、懷孕或母乳餵哺、急性青光眼發作。')
        :v.k==='preg'?S('TX','Ipratropium Bromide (Atrovent)','懷孕 28 星期。','Atrovent 可唔可以俾？',['唔可以：懷孕係禁忌','可以 40 mcg','俾一半劑量','可以，冇問題'],'Atrovent 禁忌：< 12 歲、敏感、懷孕或母乳餵哺、急性青光眼發作。')
        :v.k==='glau'?S('TX','Ipratropium Bromide (Atrovent)','有青光眼病歷，但而家冇急性發作。','Atrovent 點用？',['可以用 40 mcg（2 puffs），用前叫病人閉眼並用紗布遮住雙眼','唔可以用','用 80 mcg','直接噴，唔使理眼'],'有青光眼病歷而未有急性發作，仍可用 Atrovent，但使用前要請病人閉上雙眼並用紗布遮擋。')
        :S('TX','Ipratropium Bromide (Atrovent)','≥ 12 歲、冇禁忌。','Atrovent 劑量？',['40 mcg（2 puffs）','20 mcg（1 puff）','80 mcg（4 puffs）','400 mcg'],'Atrovent 40 mcg／2 puffs。'),
        LG('病人坐起上車床。',null,['LOAD & GO，途中繼續觀察，需要時繼續行使 Respiratory Protocol','留喺現場等完全唔氣促','叫病人行落樓','唔使送院'])],
      hosp:H(S('RE','相隔 5 分鐘重新評估','仍然氣促、有喘鳴；病人表示仍然辛苦。','點處理？',['相隔 5 分鐘，俾相應歲數嘅第 2 劑 Ventolin','停止所有用藥','俾雙倍劑量','改俾 ASA'],'有氣促徵狀或病人表示仍然氣促 → 與上次用藥相隔 5 分鐘，俾第 2／3／4 劑 Ventolin。',{set:{rr:22,spo2:96,hr:104}}),
        [age+'，突然氣促，'+(v.k==='copd'?'COPD 病歷':'哮喘病歷'),'用輔助肌呼吸、喘鳴、嘴唇發紺','RR 30 → 22 · SpO₂ '+(v.k==='copd'?'86% → 92%':'90% → 96%')+' · HR 114 → 104',(v.k==='copd'?'文氏面罩、':'鼻插喉氧氣、')+'Ventolin × 2'+(child||v.k==='preg'?'（冇用 Atrovent：禁忌）':'、Atrovent 40 mcg')])}; } });
  L.push({id:'hypo',ic:'🍬',cat:'藥',title:'血糖症',en:'Glycemia',
    vars:[{k:'iv',label:'唔可以吞嚥 → IV D10W'},{k:'oral',label:'可以安全吞嚥 → 口服'},{k:'high',label:"H'stix > 20 → NS"},{k:'stop',label:"2nd H'stix > 20 → 停 D10W"}],
    make(v){ const hi=v.k==='high', r1=hi?24.5:2.4; return {who:'70 歲婦人',call:'有 70 歲婦人神志不清、答非所問，家人話佢有糖尿病。',v:{hr:104,sbp:132,dbp:78,rr:18,spo2:96,avpu:v.k==='oral'?0:1,gcs:v.k==='oral'?14:13,rbs:r1,pain:0,rhythm:'sinus'},
      steps:[...BB({rse:'住宅客廳，環境安全。婦人坐喺梳化，家人陪住。',loc:v.k==='oral'?[0,'清醒但有啲混亂、手震，可以正常吞嚥。']:[1,'叫佢會望你，但答非所問、講嘢含糊。'],d:[0,'冇跌倒、冇撞頭。'],cab:'橈動脈 104 次；氣道暢通；呼吸 18 次，深度足夠。',cabQ:{q:'CAB 正常，係咪要用 BVM？',o:['唔使：呼吸率同深度足夠，繼續評估','要即刻 BVM','要即刻插 OPA','要 CPR'],a:0,why:'Very shallow、very slow、laboured、gasping、發紺先要 Bag。'},o2:['room','SpO₂ 96%，冇呼吸困難。'],rbs:'冇傷勢。',skin:hi?'皮膚乾、口乾。':'蒼白、冒冷汗。',dec:[1,'清醒程度改變／神經功能急性變化。','清醒程度下降（例如糖尿病）屬不穩定。']}),
        S('HS',"檢查 1st H'stix","1st H'stix："+r1+' mmol/L',"血糖症規程嘅血糖讀數適用症係？",['≦ 4 mmol/L 或 > 20 mmol/L','< 6 mmol/L','≦ 2 mmol/L','> 11 mmol/L'],'Glycemia：非創傷病人有清醒程度下降／神經功能急性變化／懷疑血糖問題，及血糖 ≦ 4 或 > 20；< 12 歲禁用。',{reveal:['rbs']}),
        VS('BP 132／78 · HR 104 · RR 18 · SpO₂ 96%'),
        ...(hi?[S('TX','0.9% Normal Saline',"1st H'stix 24.5（> 20）。",'點處理？',['IV NS 200 ml／hr（一秒一滴）','D10W 100 ml FR','口服糖水','唔使處理'],"1st H'stix > 20 → LOAD & GO，IV 0.9% NS 200 ml／hr（一秒一滴，口訣「滴二三四、滴二三四」）。",{e:{q:'血糖太高，救護員會？',o:['打鹽水點滴','俾糖水','俾朱古力'],a:0,why:'血糖太高唔可以再俾糖。'}})]
        :v.k==='oral'?[S('TX','D10W：揀給藥方式','病人清醒程度輕微改變，氣道冇問題，可以安全吞嚥。',"1st H'stix ≦ 4，可以安全吞嚥，D10W 點俾？",['口服 D10W 200 ml（唔需要 Thiamine）','IV 100 ml FR + Thiamine','IV 100 ml／hr','唔使俾'],'口服：每次 200 ml，唔需要 Thiamine；IV 先需要 Thiamine。',{e:{q:'清醒又可以吞嘢嘅低血糖病人，救護員會？',o:['俾佢飲糖水 (D10W)','俾佢瞓覺','俾佢食止痛藥'],a:0,why:'可以安全吞嚥就口服糖水。'}}),
          S('HS',"開始 5 分鐘後檢查 2nd H'stix","2nd H'stix：3.8 mmol/L。","2nd H'stix ≦ 4，點處理？",['再口服 D10W 200 ml（口服最多 400 ml）','改 IV Full Rate','停止','俾 Glucagon'],"2nd H'stix ≦ 4：口服每次 200 ml（最多 400 ml）；IV 就 100 ml／FR。",{reveal:['rbs'],set:{rbs:5.6,avpu:0,gcs:15,hr:94}})]
        :[S('TX','D10W：揀給藥方式','病人 V 級，唔可以安全吞嚥。',"1st H'stix ≦ 4，唔可以安全吞嚥，D10W 點俾？",['IV D10W 100 ml Full Rate（預先接駁 3-way）','口服 D10W 200 ml','IV 100 ml／hr（兩秒一滴）','唔使俾'],'口服要可以安全吞嚥；IV 1st ≦ 4 → 100 ml／FR。IV 不成功或無法 IV，留意 Glucagon。',{e:{q:'唔清醒嘅低血糖病人，救護員會？',o:['經靜脈俾糖水 (D10W)','餵佢食糖','叫佢瞓覺'],a:0,why:'唔清醒嘅病人唔可以餵嘢食，會哽親。'}}),
          S('TX','俾 IV D10W 時嘅預防用藥','冇 Thiamine 敏感。','俾 IV D10W 時要預防性俾咩？',['Thiamine 50 mg（0.5 ml，3-way 落藥）','Glucagon','Midazolam','ASA'],'Thiamine 適用症：給予 D10W (IV) 時嘅預防；口服唔需要。'),
          v.k==='stop'?S('HS',"開始 5 分鐘後檢查 2nd H'stix","2nd H'stix：21.2 mmol/L；病人清醒。","2nd H'stix > 20，點處理？",['停止輸入 D10W','繼續 100 ml FR','改 100 ml／hr','再俾 Thiamine'],"2nd H'stix > 20 → 停止輸入糖水 (D10W)。",{reveal:['rbs'],set:{rbs:21.2,avpu:0,gcs:15,hr:94}})
          :S('HS',"開始 5 分鐘後檢查 2nd H'stix","2nd H'stix：5.8 mmol/L；病人開始清醒。","2nd H'stix > 4 及 ≦ 20，D10W 點調？",['改為 100 ml／hr（兩秒一滴）','再俾 100 ml FR','停止所有輸液','改口服 400 ml'],"2nd > 4 及 ≦ 20 → 100 ml／hr；> 20 → 停止 D10W。",{reveal:['rbs'],set:{rbs:5.8,avpu:0,gcs:15,hr:94}})]),
        LG('病人用車床上車。','送院途中問病歷用咩口訣？',['MIAMIA（進食、胰島素、活動、藥物、疾病、酒精）','OPQRST','SAPHBUS','3N'],'Glycemia：上車後問病歷及發生經過，詢問 MIAMIA。')],
      hosp:H(S('RE','途中重新評估','病人清醒。','如果 IV 試咗 1／2／3 次都唔成功，應該留意用咩？',['Glucagon（胰高血糖素）','Midazolam','Adrenaline','NTG'],'1／2／3 次 IV 不成功或無法進行 IV → 留意是否需要使用 Glucagon。'),
        ['70 歲女，糖尿病，今朝開始神志不清',(v.k==='oral'?'清醒程度輕微改變':'清醒程度 V')+"，1st H'stix "+r1,(hi?"HR 104 · H'stix 24.5（仍高）· 清醒程度未有明顯改變":"HR 104 → 94 · H'stix 2.4 → "+(v.k==='stop'?'21.2':v.k==='oral'?'5.6':'5.8')+' · 清醒程度改善'),hi?'IV NS 200 ml／hr':v.k==='oral'?'口服 D10W 200 ml × 2':v.k==='stop'?'IV D10W 100 ml FR、Thiamine 50 mg，已停 D10W':'IV D10W 100 ml FR、Thiamine 50 mg，之後 100 ml／hr'])}; } });
  L.push({id:'glucagon',ic:'💉',cat:'藥',title:'胰高血糖素',en:'Glucagon',
    vars:[{k:'im',label:'IV 失敗 → Glucagon IM'},{k:'sc',label:'有 IMI 禁忌症 → SC'},{k:'pheo',label:'嗜咯細胞瘤 → 禁用'}],
    make(v){ return {who:'58 歲男子',call:'有 58 歲男子喺公園暈暈沉沉，朋友話佢有糖尿病。',v:{hr:108,sbp:126,dbp:76,rr:18,spo2:97,avpu:1,gcs:12,rbs:2.1,pain:0,rhythm:'sinus'},
      steps:[...BB({rse:'公園長櫈，環境安全。男子半坐半瞓，冒汗。',loc:[1,'叫佢會應，但含糊。'],d:[0,'冇跌倒。'],cab:'橈動脈 108 次；氣道暢通；呼吸 18 次。',o2:['room','SpO₂ 97%，冇呼吸困難。'],rbs:'冇傷勢。',skin:'蒼白、濕冷。',shock:1,dec:[1,'清醒程度下降。']}),
        S('HS',"檢查 1st H'stix","1st H'stix：2.1 mmol/L",'下一步？',['試 IV D10W；1／2／3 次 IV 失敗或無法 IV 就考慮 Glucagon','即刻 Glucagon，唔使試 IV','俾口服糖水','俾 Midazolam'],'Glucagon 適用症：同 Glycemia 一樣，加上 H\'stix ≦ 4 及 1／2／3 次 IV 嘗試失敗或無法進行 IV。',{reveal:['rbs']}),
        VS('BP 126／76 · HR 108 · RR 18 · SpO₂ 97%'),
        S('TX','IV 嘗試','試咗 3 次 IV 都唔成功。'+(v.k==='sc'?'病人有 IMI 禁忌症。':'')+(v.k==='pheo'?'家人拎出病歷：有嗜咯細胞瘤 (Phaeochromocytoma)。':''),'下一步？',v.k==='pheo'?['唔可以用 Glucagon（禁忌），LOAD & GO，途中可再試 IV','照俾 Glucagon 1 mg','俾雙倍 Glucagon','口服 D10W']:v.k==='sc'?['Glucagon 1 mg 經皮下 (SC) 注射','唔可以俾','Glucagon 1 mg IV','Glucagon 2 mg IM']:['Glucagon 1 mg（1 ml）肌肉注射','Glucagon 0.5 mg','Glucagon 1 mg IV','唔可以俾'],'Glucagon 1 mg／1 ml；禁忌：< 12 歲、敏感、嗜咯細胞瘤。有 IMI 禁忌症可以 SC 注射。'),
        LG('病人用車床上車。','送院途中、未到檢查 2nd H\'stix 之前，可以做咩？',['再試餘下嘅 IV 次數（最多 3 次），或病人冇氣道問題、可以吞嚥就飲 D10W','乜都唔做','俾第二劑 Glucagon','俾 Thiamine 先'],'Glucagon 流程：途中可嘗試餘下 IV 次數，或病人可以自行吞嚥就飲 D10W。')],
      hosp:H(v.k==='pheo'?null:S('RE',"Glucagon 後 5 分鐘檢查 2nd H'stix","2nd H'stix：5.2 mmol/L",'2nd H\'stix > 4 及 ≦ 20，點處理？',['密切觀察，量維生指數','再俾 Glucagon','俾 D10W FR','停止觀察'],"2nd > 4 及 ≦ 20：密切觀察；如有 IV 就 D10W 100 ml／hr。",{reveal:['rbs'],set:{rbs:5.2,avpu:0,gcs:15,hr:96}}),
        ['58 歲男，糖尿病，公園暈暈沉沉',"清醒程度 V，H'stix 2.1，IV 三次失敗"+(v.k==='pheo'?'，有嗜咯細胞瘤':''),(v.k==='pheo'?"HR 108 · H'stix 2.1 → 待複查":"HR 108 → 96 · H'stix 2.1 → 5.2"),v.k==='pheo'?'冇用 Glucagon（禁忌），途中再試 IV':'Glucagon 1 mg '+(v.k==='sc'?'SC':'IM')])}; } });
  L.push({id:'narc',ic:'💊',cat:'藥',title:'麻醉藥過量',en:'Narcotic Overdose',
    vars:[{k:'std',label:'成人，冇 IMI 禁忌'},{k:'imi',label:'有 IMI 禁忌症都要打'},{k:'young',label:'< 12 歲 → 禁用'}],
    make(v){ const who=v.k==='young'?'11 歲男童':'26 歲男子', arm=Math.random()<0.5, site=arm?'右前臂內側':'左大腿內側（近腹股溝）', st=arm?'手臂':'大腿'; const yg=v.k==='young'; return {who,marks:yg?null:arm?'armR':'thighL',call:yg?'屋企有'+who+'叫極都唔醒，家人話佢可能誤飲咗阿爺嘅美沙酮。':'後樓梯有'+who+'昏迷，旁邊有針筒。',v:{hr:56,sbp:100,dbp:62,rr:6,spo2:84,avpu:3,gcs:3,rbs:5.4,pain:0,rhythm:'brady'},
      steps:[...BB({rse:yg?'住宅客廳，枱面有一支打開咗嘅美沙酮藥水樽，家人好驚慌。':'後樓梯，地上有用過嘅針筒、針嘴同藥樽。',rseQ:{q:'RSE 時要特別留意咩？',o:['附近有冇麻醉藥／藥樽／注射器（小心針刺）','樓梯有幾多級','病人錢包','天氣'],a:0,why:'Narcotic Overdose 流程：RSE 檢查附近有無麻醉藥／藥樽／注射器。'},loc:[3,'冇反應。'],d:[0,yg?'家人話佢喺梳化慢慢瞓低，冇跌倒。':'旁人話佢坐低之後慢慢瞓低，冇跌倒。'],cab:'橈動脈 56 次；鼻鼾聲；呼吸 6 次、非常淺。',cabQ:{q:'呼吸 6 次、非常淺，點處理？',o:['OPA（拒絕就試 NPA），用 BVM Bagging','鼻插喉 2 L','觀察 5 分鐘','擺坐姿'],a:0,why:'如病人呼吸非常淺／非常慢，使用 BVM；病人拒絕 OPA 可試 NPA。'},o2:['bvm','SpO₂ 84%。',92],rbs:'瞳孔針孔狀 (Pin point)；冇明顯外傷。',rbsQ:{q:'RBS 發現瞳孔針孔狀，加上呼吸又慢又淺，要諗起？',o:['麻醉劑（鴉片類）過量','低血糖','中風','中暑'],a:0,why:'Narcotic 流程：檢查瞳孔是否 Pin point、針孔（常見於手臂／腹股溝）、旁觀者資料。'},skin:yg?'嘴唇同指甲發紺、皮膚濕冷；冇針孔。':'嘴唇同指甲發紺、皮膚濕冷；'+site+'有多個針孔同瘀痕。',skinQ:yg?{q:'嘴唇、指甲發紺代表？',o:['缺氧，要繼續有效 BVM 通氣','曬傷','好健康','皮膚敏感'],a:0,why:'發紺 = 缺氧。小朋友誤服鴉片類藥物（例如美沙酮）一樣會呼吸抑制、瞳孔針孔狀。'}:{q:'皮膚發紺，'+st+'有多個新舊針孔同瘀痕，代表？',o:['缺氧，加上經常注射藥物（支持麻醉藥過量）','曬傷','蚊叮','皮膚敏感'],a:0,why:'發紺 = 缺氧。Narcotic 流程要檢查針孔，常見於手臂、腹股溝／大腿內側，配合 Pin point 瞳孔同呼吸抑制，支持鴉片類過量。'},dec:[1,'清醒程度下降、呼吸抑制。']}),
        VS('BP 100／62 · HR 56 · RR 6（BVM 中）· SpO₂ 92%'),
        S('TX','Naloxone：確認適用症、排除禁忌症',v.k==='young'?'11 歲。':v.k==='imi'?'病人有 IMI 禁忌症（服用抗凝血藥）。':'≥ 12 歲、冇敏感。','點處理？',v.k==='young'?['唔可以俾 Naloxone（< 12 歲禁忌），繼續 BVM，LOAD & GO','俾 0.4 mg','俾 0.2 mg','俾 0.8 mg']:v.k==='imi'?['照樣肌肉注射 Naloxone 0.4 mg，注射後加壓止血並通知醫護人員','唔可以俾','改 SC','俾 0.2 mg']:['Naloxone 0.4 mg（1 ml）肌肉注射','Naloxone 4 mg','唔可以俾','Naloxone 0.04 mg'],'Naloxone 0.4 mg／1 ml；適用：麻醉劑過量、清醒程度下降及需要 BVM。禁忌：< 12 歲、敏感。有 IMI 禁忌症都需要注射，之後加壓止血。生效 2–15 分鐘，持續 30–60 分鐘。',{set:v.k==='young'?null:{rr:12,avpu:1,gcs:11,spo2:96,hr:80}}),
        LG('BVM 下上車床。','LOAD & GO 之後仲要做咩？',["檢查 1st H'stix，按讀數用 Glycemia Protocol",'唔使再理','俾第二劑 Naloxone 預防','俾 ASA'],"Narcotic 流程：LOAD & GO 後檢查 1st H'stix。")],
      hosp:H(S('RE','途中重新評估',v.k==='young'?'仍然需要 BVM。':'呼吸 12 次，叫佢會應。','Naloxone 持續時間有幾耐？',['30–60 分鐘（可能比麻醉藥短，要密切觀察）','24 小時','5 分鐘','永久'],'Naloxone 生效 2–15 分鐘、持續 30–60 分鐘。'),
        [who+(yg?'，懷疑誤飲美沙酮，叫唔醒':'，後樓梯昏迷，旁有針筒'),yg?'U、瞳孔針孔狀、發紺、RR 6':'U、瞳孔針孔狀、'+st+'針孔、發紺、RR 6',yg?'RR 6（BVM 中）· SpO₂ 84% → 92% · HR 56':'RR 6 → 12 · SpO₂ 84% → 96% · HR 56 → 80','OPA + BVM'+(v.k==='young'?'（< 12 歲冇用 Naloxone）':'、Naloxone 0.4 mg IM')])}; } });
  L.push({id:'charcoal',ic:'⚫',cat:'藥',title:'活性炭',en:'Activated Charcoal',
    vars:[{k:'ok',label:'2 小時內、清醒 → HKPIC 批准'},{k:'late',label:'超過 2 小時 → 禁用'},{k:'nocall',label:'30 秒接唔通 → 先離場'}],
    make(v){ return {who:'24 歲女子',call:'有 24 歲女子話食咗一樽成藥，人仲清醒。',v:{hr:98,sbp:118,dbp:72,rr:18,spo2:98,avpu:0,gcs:15,rbs:5.8,pain:0,rhythm:'sinus'},
      steps:[...BB({rse:'住宅睡房，枱面有空藥樽。',rseQ:{q:'RSE 時要做咩？',o:['檢查附近有無服用物品包裝，情況許可帶同送院','即刻掉咗佢','唔使理','影相 post 上網'],a:0,why:'Activated Charcoal 流程：檢查附近有無服用物品包裝（如情況許可，帶同送院）。'},loc:[0,'清醒、合作。'],d:[0,'冇跌倒。'],cab:'橈動脈 98 次；氣道暢通；呼吸 18 次。',o2:['room','SpO₂ 98%，冇呼吸困難。'],rbs:'冇傷勢。',skin:'正常。',dec:[0,'清醒、生命表徵穩定。']}),
        S('HX','Critical Hx：吞服時間、物品性質及數量',v.k==='late'?'約 3 小時前食咗 20 粒撲熱息痛。':'約 1 小時前食咗 20 粒撲熱息痛；冇嘔吐，吞嚥正常。','活性炭適用症包括？',['攝入過量有毒物質／藥物 2 小時內，完全清醒合作、可自行飲用、氣道暢通','任何時間都可以','昏迷病人都可以','只限小童'],'禁忌：< 12 歲、攝入超過 2 小時、敏感、清醒程度下降／不合作／吞嚥困難／氣道不暢／嘔吐、未獲 HKPIC 當值醫生批准。'),
        VS2('BP 118／72 · HR 98 · RR 18 · SpO₂ 98%'),
        v.k==='late'?S('TX','睇吓可唔可以用活性炭','攝入已超過 2 小時。','點處理？',['唔可以用活性炭，LOAD & GO','照俾 50 g','俾一半','叫病人嘔'],'攝入該物質超過 2 小時屬禁忌。')
        :S('TX','聯絡香港中毒諮詢中心','先填 FSG 337 表格，再致電 HKPIC（2772 2211）。'+(v.k==='nocall'?'電話 30 秒都未接通。':'當值醫生批准使用。'),'點處理？',v.k==='nocall'?['先行離場 LOAD & GO，送院途中再致電 HKPIC','喺現場一直等到接通','唔使批准直接俾','放棄']:['活性炭 50 g（250 ml），記錄飲用份量','100 g','25 g','唔使批准都可以俾'],'30 秒內未能接通或冇人接聽 → 先行離場，途中再試；獲批准後俾 Activated Charcoal 50 g／250 ml，記錄飲用份量；無論可唔可以飲都要填妥 FSG 337。'),
        LG('病人行上車。')],
      hosp:H(v.k==='nocall'?S('RE','途中再致電 HKPIC','接通，當值醫生批准。','點處理？',['俾活性炭 50 g（250 ml），記錄飲用份量','唔使俾','俾 100 g','到院先算'],'送院途中可繼續嘗試聯絡 HKPIC，獲批准後俾藥。'):null,
        ['24 歲女，食咗 20 粒撲熱息痛（'+(v.k==='late'?'約 3 小時前':'約 1 小時前')+'）','清醒合作，冇嘔吐','生命表徵穩定',v.k==='late'?'超過 2 小時，冇用活性炭；藥樽帶同送院':'活性炭 50 g；FSG 337 已填；藥樽帶同送院'])}; } });
  L.push({id:'fit',ic:'⚡',cat:'藥',title:'抽搐',en:'Convulsion',
    vars:[{k:'big',label:'成人 ≥ 50 kg'},{k:'small',label:'成人 < 50 kg'},{k:'child',label:'< 12 歲、> 36 kg'},{k:'stopped',label:'到場前已停 → 唔使 Midazolam'}],
    make(v){ const who=v.k==='child'?'11 歲男童（40 kg）':v.k==='small'?'25 歲女子（45 kg）':'35 歲男子（72 kg）'; const stop=v.k==='stopped'; const d1=v.k==='big'||stop?['10 mg（2 ml）','7.5 mg（1.5 ml）']:['7.5 mg（1.5 ml）','10 mg（2 ml）'];
      return {who,call:'巴士站有'+who+'倒地全身抽搐'+(stop?'，而家停咗。':'，已經大約 3 分鐘。'),v:{hr:128,sbp:150,dbp:90,rr:24,spo2:90,avpu:stop?2:3,gcs:stop?8:3,rbs:6.2,pain:0,rhythm:stop?'tachy':'noise'},
      steps:[...BB({rse:'巴士站有途人圍觀；'+(stop?'病人抽搐已經停咗，瞓喺地。':'病人倒地全身抽搐。')+'朋友話佢有癲癇。',rseQ:{q:'抽搐病人嘅現場安全，要做咩？',o:['移開附近硬物、保持空間，唔好塞嘢入口','用力按住手腳','塞毛巾入口防咬舌','扶佢企起身'],a:0,why:'保護病人同自己；唔好強行按住或塞嘢入口。'},loc:stop?[2,'對痛楚有反應。']:[3,'冇反應，仍然抽搐。'],d:[0,'朋友扶住佢慢慢落地，冇撞頭。'],cab:'頸動脈 128 次。口有分泌物。呼吸 24 次。',cabQ:stop?{q:'抽搐後 (Post-ictal) 病人，氣道點處理？',o:['擺復原臥式、Suction 清分泌物、俾氧','叫醒佢企起身','餵水','唔使理'],a:0,why:'保持氣道暢通：PositioN、SuctioN、OxygeN。'}:{q:'病人正在抽搐，要做「3N」，係？',o:['PositioN 姿勢、SuctioN 抽吸、OxygeN 氧氣','NTG、Naloxone、NS','Neck、Nose、Nerve','等佢停咗先理'],a:0,why:'抽搐流程：如病人正在抽搐 → 3N。'},o2:['nrm','SpO₂ 90%。',95],rbs:'冇明顯傷勢；舌頭輕微咬損。',skin:'嘴唇輕微發紺、冒汗。',skinQ:{q:'發紺代表？',o:['缺氧','發燒','過敏','正常'],a:0,why:'新出現嘅發紺屬情況不穩定。'},dec:[1,stop?'抽搐後未回復平時精神狀態。':'仍然全身性抽搐。']}),
        S('HX','問朋友 Critical Hx','有癲癇，今日冇食藥；到場前冇用過止抽筋藥；'+who.replace(/.*（|）/g,'')+'。','用 Midazolam 前，除咗年齡仲要確認咩？',['體重（決定劑量）','血型','身高','最後進食時間'],'Midazolam 劑量按年齡同體重。'),
        VS('BP 150／90 · HR 128 · RR 24 · SpO₂ 95%（NRM）'),
        stop?S('TX','睇吓需唔需要 Midazolam','抽搐已停咗；病人未回復平時精神狀態。','點處理？',["唔使俾 Midazolam：檢查 LOC 及 CAB、維生指數、H'stix，LOAD & GO",'照俾 10 mg 預防','俾 5 mg','俾 Naloxone'],'Midazolam 係俾仍然全身性抽搐嘅病人；停止抽搐後檢查 LOC、CAB、維生指數同 H\'stix。',{reveal:['rbs']})
        :S('TX','Midazolam 1st 劑量',who+'，仍然全身性抽搐。','1st Midazolam 劑量？',[d1[0],d1[1],'5 mg（1 ml）','2.5 mg'],'≥ 12 歲：< 50 kg 7.5 mg／1.5 ml、≥ 50 kg 10 mg／2 ml；< 12 歲而 > 36 kg：> 36 kg 及 < 50 kg 7.5 mg、≥ 50 kg 10 mg。鼻內注射前多抽 0.1 ml，每邊鼻孔一半。',{set:{rhythm:'sinus',hr:110,avpu:2,gcs:7,spo2:96},e:{q:'抽筋唔停，救護員會用咩？',o:['止抽筋藥 (Midazolam)','止痛藥','糖水'],a:0,why:'Midazolam 可以喺鼻內或肌肉注射，令抽搐停止。'}}),
        stop?LG('病人側臥上車床。'):S('TX','抽搐停止後','抽搐停咗，對痛楚有反應。',"停止抽搐後要做咩？",["檢查 LOC 及 CAB、維生指數、檢查 1st H'stix",'即刻叫佢企起身','再俾一劑 Midazolam 預防','除低氧氣'],"停止抽搐後：檢查 LOC 及 CAB、維生指數、H'stix，按讀數用 Glycemia Protocol。",{reveal:['rbs']}),
        ...(stop?[]:[LG('病人側臥上車床。')])],
      hosp:H(stop?S('RE','途中重新評估','途中再次全身抽搐！','點處理？',['檢查 LOC 及 CAB，按體重俾 1st Midazolam','唔使理','俾 Naloxone','即刻停車 CPR'],'途中再次抽搐：檢查 LOC 及 CAB，排除禁忌，按劑量表俾藥。',{set:{rhythm:'sinus',avpu:2,gcs:7,hr:110}})
        :S('RE','途中重新評估','1st 劑量後 5 分鐘再次抽搐。','2nd 劑量係？',v.k==='big'?['5 mg（1 ml）','10 mg（2 ml）','3.75 mg（0.75 ml）','唔可以再俾']:['3.75 mg（0.75 ml）','7.5 mg（1.5 ml）','5 mg（1 ml）','唔可以再俾'],'2nd 劑量：≥ 50 kg 5 mg／1 ml；< 50 kg（或 > 36 kg 及 < 50 kg）3.75 mg／0.75 ml；5 分鐘內冇用過 Benzodiazepines。'),
        [who+'，癲癇，全身抽搐約 3 分鐘','舌頭咬損、冇撞頭；H\'stix 6.2','HR 128 → 104 · SpO₂ 90% → 97%','3N、NRM'+(stop?'、途中再抽搐後 Midazolam × 1':'、Midazolam × 2')])}; } });
  L.push({id:'ana',ic:'🦐',cat:'藥',title:'過敏反應',en:'Basic Anaphylaxis',
    vars:[{k:'abc',label:'成人 A+B+C，冇自己 EpiPen'},{k:'own',label:'已用自己第一支 EpiPen'},{k:'child',label:'小童 → Jext 150'},{k:'ac',label:'A+C，冇氣道阻塞'}],
    make(v){ const child=v.k==='child', who=child?'9 歲女童':'28 歲男子', airway=v.k!=='ac'; return {who,call:'有'+who+'食完蝦全身出疹'+(airway?'、話喉嚨緊、氣促。':'、頭暈。'),v:{hr:124,sbp:84,dbp:50,rr:airway?28:22,spo2:airway?91:95,avpu:0,gcs:15,rbs:6.1,pain:3,rhythm:'tachy'},
      steps:[...BB({rse:'茶餐廳環境安全；枱面有食剩嘅蝦。'+(v.k==='own'?'病人 3 分鐘前已經用咗自己嘅 EpiPen。':''),rseQ:{q:'到場時除咗現場安全，仲要留意咩？',o:['過敏反應跡象同可能嘅致敏原','餐廳衛生評級','食物價錢','有冇其他客人'],a:0,why:'過敏反應流程：RSE 時留意過敏性反應跡象。'},loc:[0,'清醒，好焦慮。'],d:[0,'冇跌倒。'],cab:'摸唔到橈動脈（頸動脈快而弱）。'+(airway?'聲沙、有喘鳴；呼吸 28 次。':'氣道暢通；呼吸 22 次，冇喘鳴。'),cabQ:{q:'摸唔到橈動脈脈搏代表？',o:['血壓低 = 休克 → 將病人躺平','正常','要即刻 CPR','只係緊張'],a:0,why:'過敏反應流程：C 冇橈動脈 = 血壓低 = 休克（將病人躺平）。'},o2:['nrm','SpO₂ '+(airway?'91%':'95%')+'。',96],rbs:'嘴唇腫。',rbsQ:{q:'嘴唇腫屬於邊類跡象？',o:['A：皮膚／黏膜（Angioedema）','B：氣道阻塞','C：血壓低','唔相關'],a:0,why:'A：蕁麻疹、風疹塊、全身潮紅、嘴唇腫。'},skin:'全身風疹塊、潮紅。',skinQ:{q:'符合過敏反應適用症邊個組合？',o:[airway?'A + B + C':'A + C','只有 A','只有 B','唔符合'],a:0,why:'A 皮膚 + B 氣道阻塞（經聽診）+ C 血壓低 (SBP < 90)：A+B、A+C 或 A+B+C。'},dec:[1,'過敏反應有休克徵狀。','嚴重敏感屬不穩定；DECISION：移去致敏原。']}),
        VS('BP 84／50 · HR 124 · RR '+(airway?28:22)+' · SpO₂ 96%（NRM）'),
        v.k==='own'?S('TX','第二支 Jext／EpiPen','病人有兩支自己嘅 EpiPen；第一支 3 分鐘前已用。','點處理？',['唔應喺現場拖延等夠 5 分鐘；LOAD & GO，途中與第一支相隔 5 分鐘先用第二支','即刻打第二支','打處方提供嘅 Jext 300，再打自己兩支','唔可以再用'],'同一次過敏一日內可用兩支（先用病人自己嘅），每支相隔 5 分鐘；到場前已用咗，就唔應喺現場拖延至夠 5 分鐘。')
        :S('TX','Jext／EpiPen',(child?'小童':'成人')+'，冇自己嘅 Jext／EpiPen；對 Adrenaline 冇敏感。','點處理？',child?['處方提供嘅 Jext 150（0.15 mg）肌肉注射，停留 10 秒','Jext 300','唔使用','一次過打兩支']:['處方提供嘅 Jext 300（0.3 mg）肌肉注射，停留 10 秒','Jext 150','唔使用','一次過打兩支'],'成人 0.3 mg、小童 0.15 mg；處方提供上限一支；注射後停留 10 秒先抽出。',{set:{sbp:88,hr:118},e:{q:'嚴重過敏，救護員會用咩？',o:['腎上腺素筆 (Jext／EpiPen)','止痛藥','冰袋'],a:0,why:'腎上腺素係嚴重過敏嘅第一線藥物。'}}),
        S('TX','Chlorpheniramine (Piriton)',child?'9 歲。':'≥ 12 歲、冇敏感、4 小時內冇用抗組織胺。','Piriton 點處理？',child?['唔可以俾：< 12 歲係禁忌','10 mg IM','5 mg IM','20 mg']:['10 mg（1 ml）肌肉注射','5 mg','20 mg','唔可以俾'],'Piriton 10 mg／1 ml；禁忌：< 12 歲、敏感、4 小時內用過抗組織胺；有 IMI 禁忌症就唔使打 Piriton。'),
        airway?S('TX','Salbutamol (Ventolin)','聽診確認有下呼吸道阻塞。','Ventolin 劑量？',child?['300 mcg（3 puffs）','400 mcg（4 puffs）','200 mcg','唔適用']:['400 mcg（4 puffs）','200 mcg（2 puffs）','300 mcg（3 puffs）','唔適用'],'2 至 < 5 歲 200 mcg、5 至 < 12 歲 300 mcg、≥ 12 歲 400 mcg。',{set:{rr:23,spo2:97}})
        :S('TX','Salbutamol (Ventolin)','聽診冇上／下呼吸道阻塞。','Ventolin 點處理？',['唔使俾：冇呼吸道阻塞','照俾 400 mcg','俾 200 mcg','俾 Atrovent'],'Ventolin 只係俾經聽診確認有上／下呼吸道阻塞嘅病人。'),
        child?S('TX','0.9% Normal Saline','9 歲。','NS 點處理？',['唔可以：< 12 歲係禁忌','500 ml FR','100 ml／hr','1000 ml'],'過敏反應規程 NS 禁忌：< 12 歲。')
        :S('TX','0.9% Normal Saline','SBP 88（< 90），未俾過 NS。','點處理？',['NS 500 ml Full Rate','100 ml／hr（兩秒一滴）','唔使俾','1000 ml 一次過'],'SBP < 90（俾咗 0／1 次 500 ml FR 後）→ 500 ml／FR；Full Rate 不超過 1000 ml。',{set:{sbp:92,hr:110}}),
        LG('病人躺平上車床。','要送去邊間醫院？',['最就近醫院（嚴重過敏反應）','創傷中心','病人想去嘅私家醫院','唔使送院'],'心搏停止、呼吸停止、嚴重敏感嘅病人要送往最就近醫院。')],
      hosp:H(v.k==='own'?S('RE','與第一支相隔 5 分鐘','仍有休克徵狀；病人仲有第二支自己嘅 EpiPen。','點處理？',['確認適用症，用第二支 EpiPen','唔使用','用處方 Jext 300 再加自己一支','等到院'],'還有第二支 Jext／EpiPen 及未超過使用量 → 與第一支相隔 5 分鐘使用。',{set:{sbp:96,hr:104}})
        :child?null:S('RE','途中重新評估','BP 92／58（已俾一次 500 ml FR）。','NS 應該點調？',['SBP ≥ 90 且曾俾一次 500 ml FR → 500 ml／hr（兩秒五滴）','再俾 500 ml FR','停止 NS','100 ml／hr'],'SBP ≥ 90：從未俾 FR → 100 ml／hr；曾俾一次 500 ml FR 後 → 500 ml／hr。',{set:{sbp:96,hr:104}}),
        [who+'，食蝦後全身出疹'+(airway?'、喉嚨緊、氣促':''),'過敏反應 '+(airway?'A+B+C':'A+C')+'：風疹塊、嘴唇腫'+(airway?'、喘鳴':'')+'、冇橈動脈','BP 84／50 → 96／60 · HR 124 → 104','NRM、'+(v.k==='own'?'EpiPen × 2（病人自己）':child?'Jext 150':'Jext 300')+(child?'':'、Piriton 10 mg')+(airway?'、Ventolin':'')+(child?'':'、NS')])}; } });
  L.push({id:'hypovol',ic:'🩸',cat:'藥',title:'低血容積',en:'Hypovolemia',
    vars:[{k:'bleed',label:'創傷大量失血 SBP < 90'},{k:'dehyd',label:'嘔吐腹瀉脫水'},{k:'heat',label:'炎熱劇烈運動、SBP ≥ 90'},{k:'kid',label:'< 12 歲 → 禁用'}],
    make(v){ const who=v.k==='kid'?'10 歲男童':v.k==='heat'?'40 歲男子（行山）':v.k==='dehyd'?'78 歲婆婆':'32 歲電單車司機'; const sbp=v.k==='heat'?96:82, tr=v.k==='bleed';
      return {who,call:v.k==='bleed'?'有電單車撞欄，司機大腿流好多血。':v.k==='dehyd'?'有 78 歲婆婆嘔吐肚瀉兩日，好虛弱。':v.k==='heat'?'有行山人士頭暈、大量出汗。':'有 10 歲男童肚瀉多日，好虛弱。',v:{hr:126,sbp,dbp:52,rr:24,spo2:95,avpu:0,gcs:15,rbs:5.6,pain:tr?7:2,rhythm:'tachy'},
      steps:[...BB({rse:tr?'公路旁，警察已封路。司機坐喺路邊，大腿傷口大量出血。':'環境安全。',rseQ:tr?{q:'見到病人嚴重出血，RSE 之後即刻要？',o:['盡快止血：立即安排人手直接加壓','先填表','先量血壓','先問病史'],a:0,why:'Hypovolemia 流程：RSE → 盡快止血（嚴重出血）。'}:null,loc:[0,'清醒，好虛弱。'],d:tr?[1,'電單車撞欄，頸痛。']:[0,'冇跌倒。'],cab:'橈動脈弱而快，126 次；氣道暢通；呼吸 24 次。',o2:['nrm','SpO₂ 95%。',98],rbs:tr?'右大腿開放性傷口，已加壓止血。':'眼睛凹陷、口唇乾。',rbsQ:tr?null:{q:'以下邊樣係脫水症狀？',o:['脈搏快、低血壓、眼睛凹陷、口乾、虛弱','皮膚潮紅、發熱','瞳孔針孔狀','嘴唇腫'],a:0,why:'脫水：脈搏加快、低血壓、皮膚失彈性、眼睛凹陷、口乾、心慌、呼吸急促、虛弱、頭暈、清醒程度下降。'},skin:'蒼白、濕冷。',shock:1,dec:[1,'出現休克徵狀。']}),
        S('HX','確認適用症',v.k==='bleed'?'創傷大量失血 (A) + 休克 (D)。':v.k==='heat'?'炎熱潮濕下劇烈運動、脫水 (C) + 預期休克 (D)。':'嘔吐腹瀉大量體液流失 (B) + 休克 (D)。','Hypovolemia 適用症組合係？',['A／B／C 其中一項 + D（出現或預期出現休克）','只要有 A 就得','只要有 D 就得','A + B + C 三項齊'],'A 大量失血、B 大量體液流失、C 炎熱潮濕劇烈運動；要配合 D：出現休克或預期出現休克。禁忌：< 12 歲。'),
        LG('上車床。',tr?'創傷大量失血，幾時開始運送？':'下一步？',tr?['儘早 LOAD & GO（留意創傷中心），避免喺現場做靜脈注射','喺現場插好 IV 先走','等 NS 滴完先走','等警察落口供先走']:null,tr?'儘早運送，避免喺現場靜脈注射，除非病人被困或 Paramedic MC／RRV 主管等緊救護車。':null),
        VS('BP '+sbp+'／52 · HR 126 · RR 24 · SpO₂ 98%（NRM）'),
        v.k==='kid'?S('TX','0.9% Normal Saline','10 歲。','NS 點處理？',['唔可以：Hypovolemia Protocol < 12 歲禁忌','500 ml FR','100 ml／hr','1000 ml'],'Hypovolemia 禁忌：< 12 歲。')
        :v.k==='heat'?S('TX','0.9% Normal Saline','SBP 96（≥ 90），從未俾過 500 ml FR。','NS 點處理？',['100 ml／hr（兩秒一滴）','500 ml FR','500 ml／hr','唔使俾'],'SBP ≥ 90（從未俾 500 ml FR）→ 100 ml／hr，口訣「滴二三四、一二三四」。')
        :S('TX','0.9% Normal Saline','SBP 82（< 90），從未俾過 NS。','NS 點處理？',['500 ml Full Rate','100 ml／hr','500 ml／hr','唔使俾'],'SBP < 90（俾咗 0／1 次 500 ml FR 後）→ 500 ml／FR；Full Rate 不超過 1000 ml。',{set:{sbp:92,hr:112},e:{q:'失血、血壓低，救護員會？',o:['打鹽水點滴補充血容量','俾佢飲咖啡','叫佢行吓'],a:0,why:'靜脈注射鹽水幫助維持血壓。'}}),
        ...(tr?[S('TX','其他 Protocol','創傷 1 小時內、≥ 18 歲、SBP < 90。','仲要留意咩？',['Tranexamic Acid (TXA) 傳明酸 Protocol，同埋創傷中心','ASA','Glucagon','唔使'],'創傷引致大量失血（內／外出血）→ 參考 TXA Protocol；留意是否需要前往創傷中心。')]:[])],
      hosp:H(v.k==='kid'||v.k==='heat'?null:S('RE','途中重新評估','BP 92／58（已俾一次 500 ml FR）。','NS 點調？',['SBP ≥ 90 且曾俾一次 500 ml FR → 500 ml／hr（兩秒五滴）','再俾 500 ml FR','停止','100 ml／hr'],'按收縮壓調整 NS Rate。',{set:{sbp:96,hr:106}}),
        [who+'，'+(v.k==='bleed'?'電單車撞欄，大腿大量出血':v.k==='heat'?'炎熱下行山、大量出汗':'嘔吐腹瀉多日'),'休克徵狀：脈弱快、皮膚濕冷'+(tr?'，大腿開放性傷口':''),'BP '+sbp+' → '+(v.k==='kid'||v.k==='heat'?sbp:96)+' · HR 126'+(v.k==='kid'||v.k==='heat'?'':' → 106'),'NRM、'+(v.k==='kid'?'（< 12 歲冇用 NS）':v.k==='heat'?'NS 100 ml／hr':'NS 500 ml FR → 500 ml／hr')+(tr?'、直接加壓止血、考慮 TXA':'')])}; } });
  L.push({id:'tramadol',ic:'🩼',cat:'藥',title:'曲馬多',en:'Tramadol',
    vars:[{k:'big',label:'≥ 50 kg → 75 mg'},{k:'small',label:'< 50 kg → 50 mg'},{k:'epi',label:'癲癇病歷 → 禁用'},{k:'teen',label:'< 18 歲 → 禁用'}],
    make(v){ const who=v.k==='teen'?'16 歲男學生':v.k==='small'?'45 歲女子（46 kg）':'50 歲男子（75 kg）'; return {who,call:'有'+who+'跌倒，小腿明顯變形，劇痛。',v:{hr:104,sbp:132,dbp:82,rr:20,spo2:97,avpu:0,gcs:15,rbs:6,pain:9,rhythm:'sinus'},
      steps:[...BB({rse:'屋苑樓梯，環境安全。',loc:[0,'完全清醒，痛到喊。'],d:[0,'冇撞頭、冇頸痛，自己坐起。'],cab:'橈動脈 104 次；氣道暢通；呼吸 20 次。',o2:['room','SpO₂ 97%，冇呼吸困難。'],rbs:'右小腿閉合性骨折、變形。',skin:'正常。',dec:[0,'清醒、生命表徵穩定。','冇威脅生命嘅情況。Tramadol 前要完成：脊柱保護、制止大量出血、處理軟組織及骨骼創傷。']}),
        S('HX','Critical Hx：Penthrox 試過未？','已經用咗 Penthrox，冇止痛效果。'+(v.k==='epi'?'有癲癇病歷。':'')+'兩星期內冇食止咳水、冇精神科藥、冇濫藥、冇飲酒、冇懷孕。','Tramadol 適用症係？',['軀體／肢體創傷劇痛、完全清醒，及拒絕／不能用 Penthrox 或 Penthrox 冇效','任何痛症都可以','只限小朋友','只限頭痛'],'Tramadol 禁忌 CHEAP PAIN：止咳水、SBP < 90、癲癇、< 18 歲、精神科藥、懷孕／母乳、濫藥、醉酒、對麻醉劑／Tramadol 敏感。',{reveal:['pain']}),
        VS2('BP 132／82 · HR 104 · RR 20 · SpO₂ 97%'),
        v.k==='epi'||v.k==='teen'?S('TX','Tramadol：排除禁忌症',v.k==='epi'?'有癲癇病歷。':'16 歲。','可唔可以俾？',['唔可以（CHEAP PAIN 禁忌）','可以 75 mg','可以 50 mg','俾一半'],v.k==='epi'?'E：Epilepsy 有癲癇或癲癇病歷。':'A：Age < 18 歲。')
        :S('TX','Tramadol：劑量',who+'。','Tramadol 劑量？',v.k==='big'?['75 mg（1.5 ml）肌肉注射','50 mg（1 ml）','100 mg','25 mg']:['50 mg（1 ml）肌肉注射','75 mg（1.5 ml）','100 mg','25 mg'],'< 50 kg 50 mg／1 ml；≥ 50 kg 75 mg／1.5 ml；有 IMI 禁忌症就唔使打。',{set:{pain:5},e:{q:'骨折好痛，綠哨子冇效，救護員可以？',o:['按規程注射止痛藥 (Tramadol)','俾佢飲酒','乜都唔做'],a:0,why:'Tramadol 係另一隻止痛藥，有好多禁忌要先排除。'}}),
        S('TX','固定骨折','止痛後。','下一步？',['使用夾板固定骨折位置','叫病人行吓','唔使固定','拉直條腳'],'Tramadol 流程：給藥後用夾板固定骨折位置，再 LOAD & GO。'),
        LG('病人用車床上車。')],
      hosp:H(S('RE','途中重新評估','病人有啲反胃、頭暈。','以下邊樣係 Tramadol 常見副作用？',['反胃、嘔吐、低血壓、頭暈、倦睡','皮膚出疹','瞳孔放大','高血糖'],'最常見：反胃、嘔吐、噁心、低血壓、頭暈、口乾、出汗及便秘；亦可抑制呼吸。'),
        [who+'，跌倒，右小腿變形劇痛','閉合性骨折，Penthrox 冇效','BP 132／82 · HR 104 · 痛楚 9 → '+(v.k==='epi'||v.k==='teen'?'8':'5'),(v.k==='epi'||v.k==='teen'?'冇用 Tramadol（禁忌）':'Tramadol '+(v.k==='big'?'75':'50')+' mg IM')+'、夾板固定'])}; } });
  L.push({id:'txa',ic:'🧪',cat:'藥',title:'傳明酸',en:'Tranexamic Acid (TXA)',
    vars:[{k:'go',label:'符合：3 小時內、SBP < 90'},{k:'late',label:'受傷超過 3 小時'},{k:'bp',label:'SBP ≥ 90'},{k:'arrest',label:'注射中途心搏停止'}],
    make(v){ const sbp=v.k==='bp'?98:80; return {who:'45 歲男子',call:'地盤有工人被重物壓傷，大量出血。',v:{hr:130,sbp,dbp:50,rr:26,spo2:94,avpu:1,gcs:13,rbs:6,pain:8,rhythm:'tachy'},
      steps:[...BB({rse:'地盤已停工，重物已移開。',loc:[1,'叫佢會應，好虛弱。'],d:[1,'重物壓傷下半身，有背痛。'],cab:'橈動脈弱而快 130 次；氣道暢通；呼吸 26 次。',o2:['nrm','SpO₂ 94%。',97],rbs:'盆骨同大腿嚴重受傷，懷疑內出血。',skin:'蒼白、濕冷。',shock:1,dec:[1,'嚴重創傷、休克。']}),
        LG('儘早上車。','嚴重創傷，靜脈注射喺邊度做？',['儘早 LOAD & GO（留意創傷中心），避免喺現場做靜脈注射','喺現場做好先走','唔使做','到院先做'],'TXA 流程：儘早運送，避免現場靜脈注射；除非病人被困或 Paramedic MC／RRV 主管等緊救護車。'),
        VS('BP '+sbp+'／50 · HR 130 · RR 26 · SpO₂ 97%（NRM）'),
        S('TX','先用 Hypovolemia Protocol','SBP '+sbp+'。','點處理？',sbp<90?['NS 500 ml Full Rate（Hypovolemia Protocol）','NS 100 ml／hr','唔使','1000 ml 一次過']:['NS 100 ml／hr（Hypovolemia：SBP ≥ 90 從未俾 FR）','500 ml FR','唔使','1000 ml'],'TXA 流程：使用 Hypovolemia Protocol。'),
        S('HX','Critical Hx：受傷時間',v.k==='late'?'工友話約 4 小時前已經被壓住。':'約 40 分鐘前受傷；冇 TXA 敏感。','TXA 適用症係？',['嚴重創傷懷疑大量出血、受傷 3 小時內、≥ 18 歲、SBP < 90','任何出血','只要 SBP < 100','只限 12 歲以下'],'TXA 適用症：嚴重創傷和懷疑大量出血、創傷發生 3 小時內、≥ 18 歲、SBP < 90；禁忌：對 TXA 敏感。'),
        v.k==='late'||v.k==='bp'?S('TX','TXA：確認適用症',v.k==='late'?'受傷已超過 3 小時。':'SBP 98（≥ 90）。','可唔可以俾 TXA？',['唔可以：唔符合適用症','可以','俾一半','到院先問'],v.k==='late'?'創傷要喺 3 小時內。':'要 SBP < 90。')
        :S('TX','TXA：劑量','符合適用症。','TXA 點注射？',['每分鐘 100 mg／1 ml，10 分鐘內分 10 次','一次過 1 g','每分鐘 50 mg','每 5 分鐘 500 mg'],'每分鐘注射 100 mg／1 ml，10 分鐘內分開 10 次；開始後無論血壓有冇升到 ≥ 90 都要完成 10 次。',{set:{sbp:86}})],
      hosp:H(v.k==='arrest'?S('RE','注射 TXA 途中','病人突然心搏停止！','點處理 TXA？',['將剩下劑量一次注射，之後行使 AED／Adrenaline Protocol','停止 TXA','繼續每分鐘 100 mg','抽返出嚟'],'TXA 途中心搏停止 → 剩下劑量全部一次注射，其後行使 AED 及／或 Adrenaline Protocol。',{set:{rhythm:'vf',hr:0}})
        :v.k==='go'?S('RE','注射 TXA 途中','SBP 升到 94；病人突然抽搐。','點處理？',['繼續每分鐘 100 mg 完成 10 次，同時行使 Convulsion Protocol','停止 TXA','一次過注射晒','改俾 NS'],'TXA 途中抽搐：繼續按時間每分鐘注射，並可同時行使 Convulsion Protocol；到院未完成可問醫生是否繼續。',{set:{sbp:94}})
        :S('RE','途中重新評估','SBP 仍然 < 90。','仲要留意咩？',['按收縮壓調 NS、送創傷中心','俾 TXA','俾 ASA','唔使理'],'唔符合 TXA 適用症就按 Hypovolemia Protocol 處理，留意創傷中心。'),
        ['45 歲男，地盤被重物壓傷（約 '+(v.k==='late'?'4 小時前':'40 分鐘前')+'）','盆骨、大腿嚴重受傷，懷疑內出血','BP '+sbp+'／50 · HR 130 · GCS 13','NRM、NS'+(v.k==='late'||v.k==='bp'?'（唔符合 TXA）':'、TXA 100 mg／分鐘')])}; } });
  L.push({id:'olz',ic:'😡',cat:'藥',title:'疑似興奮性譫妄',en:'Olanzapine',
    vars:[{k:'go',label:'符合 → Olanzapine 10 mg'},{k:'old',label:'> 65 歲 → 禁用'},{k:'lowbp',label:'SBP < 90 → 禁用'}],
    make(v){ const who=v.k==='old'?'70 歲男子':'30 歲男子'; const sbp=v.k==='lowbp'?86:148; return {who,call:'有'+who+'喺街情緒激動、揮拳，警察在場。',v:{hr:132,sbp,dbp:v.k==='lowbp'?54:90,rr:26,spo2:96,avpu:0,gcs:14,rbs:6,pain:0,rhythm:'tachy'},
      steps:[...BB({rse:'街上，警察已到場；病人大叫、揮拳。',rseQ:{q:'面對激動病人，RSE 要點做？',o:['保持距離、確保自己同旁人安全，警察協助','即刻衝上前按住','叫圍觀人士幫手','唔理佢'],a:0,why:'安全至上，有需要由警員協助。'},loc:[0,'清醒但思緒混亂、唔接受勸告。'],d:[0,'冇跌倒。'],cab:'脈搏 132；呼吸 26。',o2:['room','SpO₂ 96%。'],rbs:'手臂擦傷。',skin:'大量出汗、身熱。',dec:[1,'有傷害自己或他人傾向。']}),
        S('HX','先試一般方法','好言相勸、平復情緒都唔得。','Olanzapine 適用症係？',['情緒激動具侵略性、思緒混亂不接受勸告、有傷害自己或他人傾向，及未能以一般方法控制','任何發脾氣嘅人','只要飲咗酒','只要病人唔合作'],'適用症 1.1–1.3 加上 2：未能以一般方法控制。'),
        S('TX','制服','病人仍然好激動。','點做？',['喺警員或其他人士協助下用適當方法制服病人','自己一個人按住','綁住條頸','唔理佢'],'流程：在警員或其他人士協助下使用適當方法制服病人。'),
        VS('BP '+sbp+'／'+(v.k==='lowbp'?54:90)+' · HR 132 · RR 26 · SpO₂ 96%'),
        v.k==='go'?S('TX','Olanzapine：劑量','≥ 12 歲及 ≤ 65 歲、SBP 148、冇 NMS、冇急性青光眼。','點準備同注射？',['2.1 ml 注射用水溶解，抽 10 mg／2 ml，股外肌（大腿前外側中 1/3）肌肉注射','5 mg 靜脈注射','20 mg','口服'],'Olanzapine 10 mg／2 ml IMI 股外肌；有 IMI 禁忌症都要注射，之後加壓止血；生效 15–45 分鐘。',{set:{hr:112}})
        :S('TX','Olanzapine：排除禁忌症',v.k==='old'?'70 歲。':'SBP 86。','可唔可以俾？',['唔可以（禁忌）','可以 10 mg','俾 5 mg','俾 20 mg'],'禁忌：敏感、急性青光眼、< 12 歲或 > 65 歲、SBP < 90、NMS。'),
        LG('多名警員護送上車。','送院途中要點觀察？',['面對面全程留意，情況許可接 SpO₂ & ECG，體溫過高就冷凍治療','鎖喺車廂後面唔使理','俾佢瞓覺','關燈'],'途中面對面全程留意；如情況許可 SpO₂ & ECG Monitor；針對體溫過高作冷凍治療；要求多個警察護送。')],
      hosp:H(null,[who+'，街上情緒激動、具侵略性','思緒混亂、出汗、身熱','BP '+sbp+'／'+(v.k==='lowbp'?54:90)+' · HR 132','警員協助制服、'+(v.k==='go'?'Olanzapine 10 mg IM':'冇用 Olanzapine（禁忌）')+'、冷凍治療'])}; } });
  L.push({id:'penthrox',ic:'🟢',cat:'藥',title:'甲氧氟烷（綠哨子）',en:'Penthrox',
    vars:[{k:'go',label:'符合 → 3 ml'},{k:'bp',label:'SBP < 90 → 禁用'},{k:'kidney',label:'腎病 → 禁用'},{k:'preg',label:'孕婦 → 可以用'}],
    make(v){ const who=v.k==='preg'?'29 歲孕婦':'40 歲女子'; const sbp=v.k==='bp'?86:126; return {who,call:'有'+who+'行山扭傷腳踝，好痛。',v:{hr:v.k==='bp'?112:98,sbp,dbp:v.k==='bp'?52:78,rr:20,spo2:98,avpu:0,gcs:15,rbs:6,pain:8,rhythm:'sinus'},
      steps:[...BB({rse:'郊野公園山徑，環境安全。',loc:[0,'完全清醒。'],d:[0,'冇撞頭、冇頸痛。'],cab:'橈動脈 '+(v.k==='bp'?112:98)+' 次；呼吸 20 次。',o2:['room','SpO₂ 98%。'],rbs:v.k==='bp'?'右腳踝腫脹變形；佢話今日行咗 5 個鐘、成日冇點飲水，企起身會頭暈。':'右腳踝腫脹變形。',skin:v.k==='bp'?'蒼白、冒汗。':'正常。',dec:v.k==='bp'?[1,'血壓偏低 (SBP 86)、脈搏快，要密切監察。']:[0,'清醒、生命表徵穩定。']}),
        S('HX','Critical Hx',(v.k==='kidney'?'有慢性腎病。':'冇肝病、腎病。')+(v.k==='preg'?'懷孕 20 星期。':'')+'24 小時內冇用過 Penthrox；冇惡性高熱。','Penthrox 適用症係？',['所有痛症及 ≥ 12 歲','只限骨折','只限 65 歲以上','只限頭痛'],'Penthrox 禁忌：< 12 歲、SBP < 90、24 小時內用過、肝病、腎病、惡性高熱、清醒程度改變、呼吸抑制、敏感。',{reveal:['pain']}),
        (v.k==='bp'?VS:VS2)('BP '+sbp+'／'+(v.k==='bp'?52:78)+' · HR '+(v.k==='bp'?112:98)+' · RR 20 · SpO₂ 98%'),
        v.k==='bp'||v.k==='kidney'?S('TX','Penthrox：排除禁忌症',v.k==='bp'?'SBP 86。':'有腎病。','可唔可以俾？',['唔可以（禁忌）','可以 3 ml','俾 1.5 ml','俾 6 ml'],v.k==='bp'?'SBP < 90 係禁忌。':'腎病係禁忌（腎結石、肝炎、肝硬化、脂肪肝都唔可以）。')
        :S('TX','Penthrox：劑量',(v.k==='preg'?'孕婦，':'')+'冇禁忌。',v.k==='preg'?'孕婦可唔可以用？劑量？':'Penthrox 劑量？',v.k==='preg'?['可以：3 ml，Only One Dose','唔可以：懷孕係禁忌','可以 6 ml','只可以 1.5 ml']:['3 ml，Only One Dose','6 ml','1 ml 每 5 分鐘','唔限'],'Penthrox 3 ml 只俾一劑；孕婦或母乳餵哺、胎動／分娩痛都可以用。8–10 次呼吸後開始鎮痛。',{set:{pain:4},e:{q:'綠哨子 (Penthrox) 點用？',o:['病人自己含住吸入器呼吸','打針','擦喺皮膚'],a:0,why:'病人自己握住吸入器，透過吸嘴呼吸。'}}),
        S('TX','使用注意','病人開始吸入。','使用時要注意咩？',['唔好留病人無人看管；喺車上開窗通風；過度鎮靜或 SBP < 90 就停','關晒窗','俾病人自己行開','可以叫病人一次過吸晒'],'喺救護車使用時打開窗通風；唔好讓病人無人看管；呼吸困難、呼吸抑制或失去知覺即終止且同程唔再用。'),
        S('TX','固定','止痛後。','下一步？',['夾板固定骨折位置或進行其他 Protocol','叫病人行落山','唔使固定','熱敷'],'Penthrox 流程：使用夾板固定骨折位置或進行其他 Protocol。'),
        LG('用搬運椅落山上車。')],
      hosp:H(null,[who+'，行山扭傷右腳踝','腳踝腫脹變形','BP '+sbp+'／'+(v.k==='bp'?52:78)+' · HR '+(v.k==='bp'?112:98)+' · 痛楚 8 → '+(v.k==='bp'||v.k==='kidney'?'7':'4'),(v.k==='bp'||v.k==='kidney'?'冇用 Penthrox（禁忌）':'Penthrox 3 ml')+'、夾板固定'])}; } });
  L.push({id:'o2',ic:'🫧',cat:'藥',title:'氧氣治療',en:'Supplemental O₂ Therapy',
    vars:[{k:'gen',label:'一般病人 SpO₂ 85–93%'},{k:'copd',label:'COPD 有呼吸困難'},{k:'para',label:'百草枯 SpO₂ ≥ 85%'},{k:'co',label:'一氧化碳中毒'}],
    make(v){ const M={gen:['55 歲男子','發燒咳嗽、有啲氣促',91,'nc'],copd:['76 歲男子','COPD 氣促加劇',84,'ven'],para:['48 歲男子','飲咗殺草水',90,'none'],co:['36 歲女子','喺密閉房燒炭，頭痛嘔吐',99,'nrm']}[v.k];
      return {who:M[0],call:'有'+M[0]+M[1]+'。',v:{hr:104,sbp:130,dbp:80,rr:24,spo2:M[2],avpu:0,gcs:15,rbs:6,pain:0,rhythm:'sinus'},
      steps:[...BB({rse:v.k==='co'?'密閉房，已開窗通風、移走炭盆。':v.k==='para'?'住宅，枱面有殺草水樽。':'住宅，環境安全。',rseQ:v.k==='para'?{q:'攝取百草枯，救護人員要點保護自己？',o:['穿著 PPE 及配戴 N95','唔使','只戴手套','只戴口罩'],a:0,why:'O₂ 流程第 1／2 類病人：需穿著 PPE 及配戴 N95。'}:null,loc:[0,'清醒。'],d:[0,'冇跌倒。'],cab:'橈動脈 104 次；呼吸 24 次。',o2:[M[3],'SpO₂ '+M[2]+'%。'+(v.k==='co'?'（一氧化碳中毒時 SpO₂ 讀數唔可信）':v.k==='copd'?'有呼吸困難。':v.k==='para'?'':'冇 COPD，有輕微呼吸困難。'),v.k==='para'?null:v.k==='copd'?87:v.k==='co'?100:95],rbs:'冇傷勢。',skin:v.k==='co'?'面色潮紅。':'正常。',dec:[1,'需要密切監察。','有呼吸問題／中毒，屬需要密切監察嘅病人。']}),
        S('TX','氧氣類別',v.k==='gen'?'冇百草枯、唔係嚴重受傷或危疾、冇 COPD。':v.k==='copd'?'冇百草枯；有 COPD。':v.k==='para'?'攝取百草枯。':'一氧化碳中毒。','屬於 O₂ Protocol 邊一類？',v.k==='gen'?['第 4 類：非 1–3 類一般病人','第 1 類：百草枯','第 2 類：嚴重受傷或罹患危疾','第 3 類：COPD']:v.k==='copd'?['第 3 類：COPD','第 4 類一般病人','第 2 類','第 1 類']:v.k==='para'?['第 1 類：攝取百草枯','第 4 類','第 2 類','第 3 類']:['第 2 類：嚴重受傷或罹患危疾（一氧化碳中毒）','第 4 類','第 3 類','第 1 類'],'類別：1 百草枯、2 嚴重受傷或罹患危疾、3 COPD、4 非 1–3 類一般病人。'),
        VS('BP 130／80 · HR 104 · RR 24'),
        v.k==='copd'?S('TX','文氏面罩調節','用咗 0.24／3 L 兩分鐘後，SpO₂ 87%。','SpO₂ 85–89%，點調？',['提升 FiO₂ 一級，每一至兩分鐘監察','降低 FiO₂','維持','即刻轉 NRM'],'SpO₂ > 94% 降低（最低 0.24／3 L）；90–94% 維持；85–89% 提升，每 1–2 分鐘監察；< 85% 提升，每 30 秒至 1 分鐘監察；已到 0.5／6 L 就轉 NRM。',{set:{spo2:91}})
        :v.k==='para'?S('TX','監察','兩分鐘後 SpO₂ 跌到 83%。','SpO₂ < 85%，點處理？',['俾最低量氧氣，目標 SpO₂ 85–88%，每兩分鐘監察','俾 NRM 15 L 目標 100%','繼續唔俾','俾 BVM'],'SpO₂ < 85% → 最低量氧氣，目標 85–88%；之後就算 > 88% 都唔應中斷。並可嘗試活性炭程序。',{set:{spo2:86}})
        :v.k==='co'?S('TX','讀數判斷','SpO₂ 顯示 99%。','SpO₂ 99% 係咪可以唔俾氧？',['唔可以：一氧化碳中毒 SpO₂ 唔可信，照俾高濃度氧氣','可以 Room Air','俾鼻插喉 1 L 就夠','俾文氏面罩'],'一氧化碳中毒（燒炭）、貧血、大量失血、血壓過低時 SpO₂ 唔可信；就算 100% 都要俾高流量氧氣。')
        :S('TX','調節','鼻插喉 2 L 後 SpO₂ 93%。','點調？',['調高 FiO₂，維持 SpO₂ ≥ 94%；已到頂點就轉 NRM／BVM','停氧','轉文氏面罩','維持唔郁'],'一般病人：調節 FiO₂ 維持 SpO₂ ≥ 94%；FiO₂ 到頂點就轉不能回吸面罩／BVM。鼻插喉 1–4 L ≈ FiO₂ 0.24–0.36。',{set:{spo2:95}}),
        LG('上車床。',null,['LOAD & GO，途中保持監察 SpO₂，交接時避免中斷氧氣','到院先除低氧氣','途中唔使監察','停氧慳氧氣'],'應把施行補充氧氣療法嘅情況通知接收醫院；移交時盡量避免中斷。')],
      hosp:H(null,[M[0]+'，'+M[1],'SpO₂ '+M[2]+'%'+(v.k==='co'?'（讀數唔可信）':''),'HR 104 · RR 24',{gen:'鼻插喉氧氣，維持 SpO₂ ≥ 94%',copd:'文氏面罩，目標 SpO₂ 90–94%',para:'最低量氧氣，目標 85–88%',co:'NRM 高濃度氧氣'}[v.k]])}; } });
  /* ================= 心臟驟停 ================= */
  const CPRQ=(age)=>S('CPR','開始 CPR',age<8?'病人 '+age+' 歲（身高 < 115 cm），兩名救護員。':'成年病人。','CPR 按壓比率？',age<8?['30:2 單人／15:2 雙人','30:2 一律','3:1','15:1']:['30:2','15:2','3:1','5:1'],'新生嬰兒 3:1；< 8 歲 (< 115 cm) 單人 30:2、雙人 15:2；≥ 8 歲 30:2。');
  L.push({id:'aed',ic:'⚡',cat:'停',title:'自動心臟去顫器',en:'AED',
    vars:[{k:'shock',label:'第一次分析需要電擊'},{k:'pea',label:'唔需電擊、有電流、冇脈搏'},{k:'rosc',label:'唔需電擊、有電流、有脈搏'},{k:'child',label:'< 8 歲小童'}],
    make(v){ const age=v.k==='child'?6:65; const who=v.k==='child'?'6 歲女童':'65 歲男子'; return {who,call:'有'+who+'喺商場突然暈低，旁人做緊 CPR。',v:{hr:0,sbp:0,dbp:0,rr:0,spo2:0,avpu:3,gcs:3,rbs:6,pain:0,rhythm:v.k==='shock'||v.k==='child'?'vf':'pea'},
      steps:[...ARR('商場大堂，旁人做緊 CPR。'),CPRQ(age),
        S('AED','儘快接駁 AED','貼好電擊片。','電擊能量？',age<8?['50 焦耳','150 焦耳','200 焦耳','唔可以用 AED']:['150 焦耳','50 焦耳','360 焦耳','100 焦耳'],'< 8 歲 (< 115 cm) 50 焦耳；≥ 8 歲 150 焦耳；新生嬰兒禁用 AED。'),
        v.k==='shock'||v.k==='child'?S('AED','AED 第一次分析','建議電擊。','電擊後點做？',['即刻喺現場做兩分鐘 CPR，再做第二次分析','即刻檢查脈搏','即刻上車','再電一次'],'需要電擊 → 電擊 → 現場兩分鐘 CPR → 第二次分析，之後 Moving CPR 送院。',{set:{rhythm:'vf'}})
        :S('AED','AED 第一次分析','唔需要電擊；畫面有電流活動。','點做？',v.k==='rosc'?['檢查病人脈搏','即刻電擊','停止 CPR 等死亡證','再分析 10 次']:['檢查病人脈搏','即刻電擊','停止所有處理','俾 Naloxone'],'唔需要電擊 → 檢查 AED 有冇電流活動；有電流活動 → 檢查脈搏；冇電流活動 → Moving CPR 送院。'),
        v.k==='rosc'?S('AED','檢查脈搏','摸到頸動脈脈搏，開始有呼吸。','點做？',['重新檢查 LOC > CAB…、ECG & SpO₂，LOAD & GO','繼續 CPR','再電擊','俾 Adrenaline'],'有脈搏 → 重新檢查病人狀態，ECG & SpO₂，LOAD & GO，按需要施行其他 Protocol。',{set:{rhythm:'sinus',hr:88,sbp:96,dbp:60,rr:10,spo2:92,avpu:3,gcs:3}})
        :v.k==='pea'?S('AED','檢查脈搏','冇脈搏。','點做？',['Moving CPR 送院，LOAD & GO，情況許可每 2–3 分鐘分析','停止 CPR','電擊','喺現場等'],'有電流活動但冇脈搏 → Moving CPR 送院；塞車／停燈位時每 2–3 分鐘分析；按情況高級氣道處理。')
        :S('AED','AED 第二次分析','第二次分析：需要電擊。','電擊之後？',['Moving CPR 送院（LOAD & GO），情況許可每 2–3 分鐘分析','喺現場再做兩分鐘','停止 CPR','檢查瞳孔'],'第二次分析後：電擊／唔需電擊都 Moving CPR 送院。',{set:{rhythm:'vf'}}),
        LG('上車床。','心搏停止病人要送去邊？',['最就近醫院','屬區醫院','創傷中心','私家醫院'],'心搏停止、呼吸停止、嚴重敏感嘅病人要送往最就近醫院。')],
      hosp:H(S('RE','途中病情','途中如果病人再次心搏停頓，要停車做幾耐 CPR？','點處理？',['用 AED，第一次分析需要電擊就停車做兩分鐘 CPR 至第二次分析，之後即送最就近醫院','唔使停車','停車 10 分鐘','停止 CPR'],'整個旅程只有喺第一次分析需要電擊時，先停車施行兩分鐘 CPR；不論第二次分析結果都要即送最就近醫院。'),
        [who+'，商場突然暈低，旁人 CPR','冇脈搏、冇呼吸；AED '+(v.k==='shock'||v.k==='child'?'建議電擊':'唔需電擊'),v.k==='rosc'?'ROSC：HR 88 · BP 96／60':'持續 CPR 中','CPR'+(age<8?' 15:2、AED 50 J':' 30:2、AED 150 J')+(v.k==='shock'||v.k==='child'?' 電擊':'')+'、BVM'])}; } });
  L.push({id:'adr',ic:'💉',cat:'停',title:'腎上腺素',en:'Adrenaline',
    vars:[{k:'shock',label:'需要電擊 → 途中用藥'},{k:'noshock',label:'唔需電擊'},{k:'trapped',label:'病人被困 → 現場用藥'}],
    make(v){ return {who:'58 歲男子',call:'有 58 歲男子喺屋企暈低，冇呼吸。',v:{hr:0,sbp:0,dbp:0,rr:0,spo2:0,avpu:3,gcs:3,rbs:6,pain:0,rhythm:v.k==='noshock'?'asys':'vf'},
      steps:[...ARR(v.k==='trapped'?'病人困喺狹窄廁所，消防員拆緊門。':'住宅客廳，家人做緊 CPR。'),CPRQ(58),
        S('AED','AED 第一次分析',v.k==='noshock'?'唔需要電擊、冇電流活動。':'需要電擊，已電擊。','之後點做？',v.k==='noshock'?['喺現場做 CPR + AED Protocol，之後 Moving CPR 送院','即刻停 CPR','即刻打 Adrenaline 唔使 CPR','檢查瞳孔']:['喺現場做兩分鐘 CPR，再第二次分析','即刻上車','即刻打 Adrenaline','檢查脈搏'],'CPR + AED Protocol + BVM 優先。'),
        LG('Moving CPR 上車。','Adrenaline Protocol 通常幾時開始？',v.k==='trapped'?['病人被困：可喺現場、唔中斷基本生命支持下使用','一定要到院先用','一定要上車先用','唔可以用']:['救護車前往醫院途中啟動','喺現場一到就打','到院先用','唔使用'],'Adrenaline Protocol 通常喺前往醫院途中啟動；病人被困或現場冇救護車時，可在不中斷基本生命支持下喺現場使用。'),
        S('TX','確認適用症、建立 IV／IO','≥ 12 歲、心臟驟停；試咗 3 次 IV 都搵唔到靜脈。','點做？',['考慮骨內注射 (IO)','放棄用藥','肌肉注射','皮下注射'],'IO 之前先考慮 IV；最多 3 次未能建立 IV 或冇清晰可見嘅靜脈，就考慮 IO。'),
        S('TX','Adrenaline 劑量','IO 已建立。','Adrenaline 點俾？',['1 mg（10 ml），每 3–5 分鐘一次，最多 5 次','0.3 mg IM','1 mg 每分鐘','5 mg 一次'],'Adrenaline 1 mg／10 ml，每 3–5 分鐘，最多 5 次；之後調整三通 Full Rate 10 秒沖管。',{e:{q:'心臟停頓，救護員可以用咩藥？',o:['腎上腺素 (Adrenaline)','止痛藥','糖水'],a:0,why:'Adrenaline 幫助心臟停頓病人恢復循環。'}}),
        S('TX','氣道 vs 藥物優先次序','BVM 通氣有效，胸口有起伏。','先做高級氣道定先打 Adrenaline？',['BVM 通氣有效 → 先打第一劑 Adrenaline，之後先高級氣道','先插高級氣道','兩樣都唔做','先俾 Amiodarone'],'BVM 可以維持通氣就先啟動第一劑 Adrenaline；BVM 通氣無效就先處理氣道。')],
      hosp:H(v.k==='noshock'?S('RE','途中','第 1 劑 Adrenaline 已經打咗 4 分鐘；AED 再分析仍然唔需要電擊、冇電流活動。','點做？',['繼續 CPR，相隔 3–5 分鐘俾第 2 劑 Adrenaline 1 mg','即刻 Amiodarone 300 mg','停止 CPR','電擊一次試吓'],'Asystole 唔適用 Amiodarone（要 3 次電擊）；Adrenaline 每 3–5 分鐘一次，最多 5 次。'):S('RE','途中','已電擊 3 次、打咗 1 劑 Adrenaline。','仲可以考慮咩？',['Amiodarone 1st 300 mg','再打 5 mg Adrenaline','停止 CPR','俾 NS 1000 ml'],'3 次電擊（不需連續）及最少 1 劑 Adrenaline → 可俾 Amiodarone 300 mg。'),
        ['58 歲男，屋企暈低','心搏停止，'+(v.k==='noshock'?'Asystole':'VF 已電擊'),'持續 CPR','CPR、AED、BVM、IO、Adrenaline 1 mg q3–5 min'])}; } });
  L.push({id:'amio',ic:'🫀',cat:'停',title:'胺碘酮',en:'Amiodarone',
    vars:[{k:'go',label:'已電擊 3 次 + 1 劑 Adrenaline'},{k:'notyet',label:'只電擊 2 次 → 未符合'}],
    make(v){ return {who:'50 歲男子',call:'有 50 歲男子喺健身室暈低。',v:{hr:0,sbp:0,dbp:0,rr:0,spo2:0,avpu:3,gcs:3,rbs:6,pain:0,rhythm:'vf'},
      steps:[...ARR('健身室，職員用緊 AED。'),CPRQ(50),
        S('AED','AED','VF，已電擊。','之後？',['兩分鐘 CPR、第二次分析，Moving CPR 送院','停止 CPR','即刻 Amiodarone','檢查脈搏'],'CPR + AED Protocol + BVM。'),
        LG('Moving CPR 上車。'),
        S('TX','途中狀況',v.k==='go'?'途中累計電擊 3 次（不需連續），已打 1 劑 Adrenaline。':'途中累計電擊 2 次，已打 1 劑 Adrenaline。','可唔可以俾 Amiodarone？',v.k==='go'?['可以：1st 300 mg（6 ml），之後 Full Rate 10 秒沖管','唔可以','150 mg','600 mg']:['未可以：要 3 次電擊','可以 300 mg','可以 150 mg','可以 600 mg'],'Amiodarone 適用症：心臟驟停、≥ 12 歲、已電擊 3 次、已注射最少 1 劑 Adrenaline。1st 300 mg／6 ml。'),
        S('TX','2nd 劑量條件','1st Amiodarone 之後。','2nd Amiodarone 要符合咩？',['1st 之後再電擊最少 1 次、再打最少 1 劑 Adrenaline，及相隔 5 分鐘 → 150 mg（3 ml）','即刻再打 300 mg','唔可以再俾','相隔 1 分鐘 → 300 mg'],'每位病人最多兩劑，第二劑一半（150 mg／3 ml）。')],
      hosp:H(null,['50 歲男，健身室暈低','VF 心搏停止','持續 CPR','CPR、AED 電擊、Adrenaline、'+(v.k==='go'?'Amiodarone 300 mg':'未符合 Amiodarone')])}; } });
  L.push({id:'aedp',ic:'🔌',cat:'停',title:'接手已用 AED 的病人',en:'Taking over AED',
    vars:[{k:'fr',label:'先遣急救員 FR AED'},{k:'pub',label:'社區 AED(P)'},{k:'saed',label:'SAED Corpuls1 壞咗'},{k:'saedok',label:'SAED Corpuls1 正常'}],
    make(v){ const D={fr:['先遣急救員嘅 FR AED','FR AED'],pub:['商場嘅社區 AED(P)','AED(P)'],saed:['RRV 嘅 SAED Corpuls1（部機出現故障）','SAED'],saedok:['RRV 嘅 SAED Corpuls1（運作正常）','SAED']}[v.k]; return {who:'70 歲男子',call:'有 70 歲男子心臟停頓，現場已經用緊 AED。',v:{hr:0,sbp:0,dbp:0,rr:0,spo2:0,avpu:3,gcs:3,rbs:6,pain:0,rhythm:'vf'},
      steps:[S('RSE','到場、確認安全','病人已連接 '+D[0]+'。','用 AED 時，「安全情況」係指？',['AED 唔係正在分析、唔係正在電擊','AED 已關機','病人有脈搏','冇人掂病人'],'交接要喺安全情況下：AED 不是正在分析、不是正在電擊。'),
        S('AED','AED 優先次序','你哋嘅 DM／SAED 可正常使用。','AED 優先次序係？',['DM／SAED → FR AED → FSD AED（AED 搵得到）→ 社區 AED(P)','社區 AED(P) 最優先','FR AED 最優先','邊部都一樣'],'第一優先救護人員 DM／SAED；第二 FR AED；第三 FSD AED；第四 AED(P)。'),
        v.k==='saed'?S('AED','SAED 壞咗','SAED Corpuls1 出現故障，唔可以再用（唔可以喺救護車上使用）。','點做？',['改用 DM，將 SAED 內嘅 SD Card 轉交救護車主管','繼續用壞咗嘅 SAED 上車','唔使 SD Card','停止 CPR'],'SAED Corpuls1 壞咗（不可在救護車上使用）→ 改用 DM，SD Card 轉交救護車主管；到院用 SD Card 列印 ECG，連同 DM 嘅 ECG 一併提交，完成後交返 SD Card 俾 Corpuls1 擁有者。')
        :v.k==='saedok'?S('AED','SAED 運作正常','SAED Corpuls1 運作正常（可以喺救護車上使用）。','點做？',['繼續用 SAED Corpuls1 上車，繼續 AED Protocol','一定要轉用 DM','關機唔再用','停止 CPR'],'SAED Corpuls1 冇壞（可在救護車上使用）→ 繼續用佢跟 AED Protocol 送院，唔使換機；到院用 SD Card 列印 ECG，擁有者回局上載資料。如送院途中 ROSC，繼續用 SAED，只用 DM 量 BP 同 SpO₂。')
        :S('AED','更換 AED','安全情況下。','點更換？',['安全情況下關閉現場 AED（唔好移除電擊片），重新評估 LOC > D > CAB，再用 DM 開始 AED Protocol（之前電擊次數唔計）','直接拔走佢哋嘅 AED','繼續用佢哋部機上車','兩部一齊用'],v.k==='fr'?'FR AED：安全情況下關閉、不要移除電擊片、重新評估，需要時用 AED Protocol（不計算之前電擊），之後移除 FR 電擊片貼上 DM／SAED。':'更換 AED 時盡量避免中斷 CPR、避免帶嚟不必要損傷。'),
        CPRQ(70),LG('Moving CPR 上車。')],
      hosp:H(null,['70 歲男，心臟停頓','現場已用 '+D[1],'持續 CPR',v.k==='saedok'?'繼續用 SAED Corpuls1，CPR + AED Protocol':'接手後轉用 DM／SAED，CPR + AED Protocol'+(v.k!=='pub'?'，SD Card 已交主管':'')])}; } });
  L.push({id:'accm',ic:'🤖',cat:'停',title:'自動胸外按壓機',en:'ACCM',
    vars:[{k:'go',label:'成人可安裝'},{k:'preg',label:'懷孕 → 禁用'},{k:'airway',label:'已置入高級氣道'}],
    make(v){ const who=v.k==='preg'?'32 歲孕婦':'60 歲男子'; return {who,call:'有'+who+'心臟停頓。',v:{hr:0,sbp:0,dbp:0,rr:0,spo2:0,avpu:3,gcs:3,rbs:6,pain:0,rhythm:'asys'},
      steps:[...ARR('住宅，家人做緊 CPR。'),CPRQ(40),
        S('TX','ACCM 適用症',v.k==='preg'?'病人懷孕。':'成年（≥ 8 歲、身高 ≥ 115 cm），可以穩固安裝。','可唔可以用 ACCM？',v.k==='preg'?['唔可以：懷孕係禁忌，繼續手動 CPR','可以','裝喺腹部','只用一半力']:['可以：成人 ≥ 8 歲、可以正確安全穩固安裝','唔可以','只限小童','要醫生批准'],'禁忌：懷孕、胸部嚴重外傷（大面積開放損傷／胸腔嚴重變形）、附近有爆炸危機或易燃氣體。'),
        v.k==='preg'?LG('Moving CPR 上車。'):S('TX','ACCM 設定','安裝好。','ACCM 設定係？',['30:2、深度 5.0 cm、每分鐘 100 下','15:2、3 cm、80 下','連續、6 cm、120 下','3:1'],'Configured Mode 30:2；Depth 5.0 cm；Rate 100／min。'),
        ...(v.k==='airway'?[S('AW','置入高級氣道後','已置入 LMA Supreme。','ACCM 要點調？',['由 30:2 改為 continuous，每 6 秒灌氣一次，唔停按壓','維持 30:2','停機','每 2 秒灌氣'],'為病人置入高級氣道後：ACCM 由 30:2 改 cont.；每 6 秒灌氣一次；唔應為灌氣而停頓心外壓。')]:[]),
        ...(v.k==='preg'?[]:[LG('用 ACCM 上車。')])],
      hosp:H(null,[who+'，心臟停頓','Asystole','持續 CPR',v.k==='preg'?'手動 CPR（懷孕禁用 ACCM）':'ACCM 30:2'+(v.k==='airway'?' → continuous + LMA':'')])}; } });
  L.push({id:'lt',ic:'🫁',cat:'停',title:'喉管 LTS-D',en:'Laryngeal Tube',
    vars:[{k:'h4',label:'身高 5 尺半'},{k:'h3',label:'身高 4 尺半'},{k:'corr',label:'攝入腐蝕性物質 → 禁用'},{k:'poor',label:'灌氣不足 → 選項一／二'}],
    make(v){ const h=v.k==='h3'?'4 尺半':'5 尺半'; return {who:'55 歲'+(v.k==='h3'?'女子':'男子')+'（'+h+'）',call:'有人心臟停頓。',v:{hr:0,sbp:0,dbp:0,rr:0,spo2:0,avpu:3,gcs:3,rbs:6,pain:0,rhythm:'asys'},
      steps:[...ARR('住宅，'+(v.k==='corr'?'旁邊有渠水樽（腐蝕性）。':'家人做緊 CPR。')),CPRQ(55),
        S('AW','LTS-D 適用症','心臟驟停、≥ 12 歲。'+(v.k==='corr'?'懷疑飲咗腐蝕性渠水。':''),'可唔可以用 LTS-D？',v.k==='corr'?['唔可以：攝入腐蝕性物質係禁忌，用 OPA／NPA + BVM','可以','可以但細一碼','只可以用 Combitube']:['可以','唔可以','只限 18 歲以上','只限創傷'],'禁忌：上呼吸道阻塞、異物梗塞、懷疑急性會厭炎、上呼吸道腫脹、已知食道疾病、攝入腐蝕性物質。'),
        ...(v.k==='corr'?[]:[S('AW','揀尺碼','病人身高 '+h+'。','用邊個尺碼？',v.k==='h3'?['#3 黃色，灌氣 50–60 ml','#4 紅色 70–80 ml','#5 紫色 80–90 ml','#2']:['#4 紅色，灌氣 70–80 ml','#3 黃色 50–60 ml','#5 紫色 80–90 ml','#2'],'#3（4 至 < 5 尺）黃 50–60 ml；#4（5 至 6 尺）紅 70–80 ml；#5（> 6 尺）紫 80–90 ml。'),
          S('AW','插入程序','準備好。','正確程序係？',['測試袖口 → 潤滑 → 頭頸自然位 → BVM × 4 → 連續 CPR → 移除 OPA → 插入至牙齒標記 → 打氣 → 接 BVM 連 Filter → 停 CPR 聽兩邊肺同胃','直接插入唔使測試','先停 CPR 一分鐘再插','插入後唔使聽'],'LTS-D 程序：測試、潤滑、自然位、BVM × 4、連續 CPR、移除 OPA、插入、打氣、接 BVM 連 Filter、停 CPR 聽肺（Air × 2）、胃（No Air）、繼續 CPR。')]),
        ...(v.k==='poor'?[S('AW','灌氣不足','胸部起伏不足，冇肺音。','點處理？',['聽診確認位置、檢查袖口；考慮選項一（重新插入 LTS-D）或選項二（改 LMA Supreme），都唔得就返 BVM + OPA／NPA','繼續用','加大灌氣到 200 ml','停止 CPR'],'嘗試任何一個選項一次；重新定位／更換後胸部冇起伏，就取出，用 BVM 和氣道輔助裝置恢復通氣。')]:[]),
        LG('Moving CPR 上車。')],
      hosp:H(null,['55 歲，心臟停頓','Asystole'+(v.k==='corr'?'，懷疑攝入腐蝕性物質':''),'持續 CPR',v.k==='corr'?'OPA + BVM（LTS-D 禁忌）':'LTS-D '+(v.k==='h3'?'#3':'#4')+(v.k==='poor'?'（灌氣不足，已處理）':'')])}; } });
  L.push({id:'lma',ic:'😷',cat:'停',title:'喉罩 LMA Supreme',en:'LMA Supreme',
    vars:[{k:'go',label:'成人，電擊後 2 分鐘內'},{k:'kid',label:'< 12 歲 → 禁用'},{k:'swell',label:'過敏性水腫 → 禁用'}],
    make(v){ const who=v.k==='kid'?'10 歲男童':'48 歲男子'; return {who,call:'有'+who+'心臟停頓。',v:{hr:0,sbp:0,dbp:0,rr:0,spo2:0,avpu:3,gcs:3,rbs:6,pain:0,rhythm:'vf'},
      steps:[...ARR('街上，路人做緊 CPR。'+(v.k==='swell'?'朋友話佢食海鮮後嘴唇腫、氣促先暈低。':'')),CPRQ(v.k==='kid'?10:48),
        S('AED','AED','需要電擊，已電擊。','LMA Supreme 幾時插最好？',['AED Protocol 空檔，例如電擊後 2 分鐘 CPR 內，用不多於 30 秒完成','分析期間','等到院先插','停 CPR 5 分鐘插'],'喺 AED Protocol 空檔使用；現場需要電擊時，要喺 2 分鐘 CPR 內用不多於 30 秒完成整個程序（包括開始 BVM）。'),
        S('AW','LMA 適用症',v.k==='kid'?'10 歲。':v.k==='swell'?'懷疑上呼吸道過敏性水腫。':'≥ 12 歲、心臟驟停。','可唔可以用 LMA Supreme？',v.k==='go'?['可以','唔可以','只限 18 歲以上','要醫生批准']:['唔可以（禁忌），繼續 OPA／NPA + BVM','可以','用細一碼','用 #5'],'禁忌：< 12 歲；上呼吸道腫脹（膿瘡、血腫、過敏性水腫、腫瘤、吸入性損傷）、結構破壞、阻塞（異物、會厭炎、牙關緊閉、回湧）。'),
        ...(v.k==='go'?[S('AW','尺碼同灌氣','成年男子。','#4 灌氣幾多？',['45 ml','30 ml','80 ml','15 ml'],'#3 30 ml；#4 45 ml；#5 45 ml。'),
          S('AW','之後','LMA 插好。','移動病人時要注意？',['用一隻手固定 LMA；無論成功與否都要填 LMA Supreme 表格','唔使固定','拔出嚟再插','唔使填表']," 移動病人時一手固定 LMA；不論是否成功插入都要填寫表格。")]:[]),
        LG('Moving CPR 上車。')],
      hosp:H(null,[who+'，心臟停頓','VF 已電擊','持續 CPR',v.k==='go'?'LMA Supreme #4（45 ml）':'OPA + BVM（LMA 禁忌）'])}; } });
  L.push({id:'combi',ic:'🔧',cat:'停',title:'食道氣管組合管',en:'Combitube',
    vars:[{k:'eso',label:'插入食道（正常）'},{k:'tra',label:'插入氣管 → 用 #2 白管'},{k:'gag',label:'嘔吐反射完整 → 禁用'}],
    make(v){ return {who:'62 歲男子（5 尺 7 吋）',call:'有 62 歲男子心臟停頓。',v:{hr:0,sbp:0,dbp:0,rr:0,spo2:0,avpu:3,gcs:3,rbs:6,pain:0,rhythm:'asys'},
      steps:[...ARR('住宅，家人做緊 CPR。'),CPRQ(62),
        S('AW','幾時用 Combitube','LMA Supreme 插唔入，口腔不斷回湧。','可唔可以考慮 Combitube？',v.k==='gag'?['唔可以：病人仍有嘔吐反射（禁忌），用 OPA／NPA + BVM','可以','一定要用','改用 LT']:['可以：LMA 失敗或口腔不斷回湧時','唔可以','一定要先用 Combitube','到院先用'],'Combitube：LMA Supreme 插入失敗或未能插入、或口腔不斷回湧。禁忌：身高 < 4 尺、上呼吸道阻塞、異物、會厭炎、聲門水腫、食道疾病、腐蝕性物質、嘔吐反射完整。'),
        ...(v.k==='gag'?[]:[S('AW','揀尺碼','5 尺 7 吋（約 170 cm）。','用咩尺碼？',['Small adult：白 12 ml、藍 85 ml','Adult：白 15 ml、藍 100 ml','唔建議使用','任何尺碼'],'4–6 尺 (122–183 cm) small adult：白 12 ml、藍 85 ml；> 6 尺 adult：白 15 ml、藍 100 ml；< 4 尺唔建議。'),
          S('AW','#1 藍管通氣',v.k==='tra'?'#1 藍管入氣：肺部冇空氣，胃部有咕嚕聲（胃脹）。':'#1 藍管入氣：兩邊肺有入氣聲、胸口起伏，胃冇聲。','點做？',v.k==='tra'?['改用 #2 短透明（白）管通氣','繼續 #1','拔出唔再用','加大藍波']:['繼續用 #1 藍管通氣，繼續 CPR','改 #2 白管','拔出','停 CPR'],'#1 藍管入氣時肺部冇空氣而胃部有 → 可能插入咗氣道，測試 #2 白管；肺胃都冇聲而頂手 → 可能太深，放氣拔出 2–3 cm 再試；都唔得就移除改 OPA。')]),
        LG('Moving CPR 上車。')],
      hosp:H(null,['62 歲男，心臟停頓','Asystole，LMA 失敗、回湧','持續 CPR',v.k==='gag'?'OPA + BVM（嘔吐反射完整，冇用 Combitube）':'Combitube small adult，經 '+(v.k==='tra'?'#2 白管':'#1 藍管')+'通氣'])}; } });
  L.push({id:'dnacpr',ic:'📄',cat:'停',title:'不作心肺復甦術命令',en:'DNACPR Order',
    vars:[{k:'valid',label:'命令有效及適用'},{k:'choke',label:'哽塞（非自然因由）→ 不適用'},{k:'expired',label:'命令過期'},{k:'dispute',label:'家屬指已口頭撤銷'}],
    make(v){ const T={valid:['78 歲伯伯，腦轉移腫瘤，喺屋企被發現心跳驟停','家人出示 DNACPR Order（表格二），正本、填寫簽署齊全，仍在效力期內。'],choke:['70 多歲伯伯食湯圓時突然捻住喉嚨，之後冇反應','家人話佢係末期肺癌，出示有效 DNACPR Order。'],expired:['85 歲伯伯，阿茲海默症，心跳驟停','有醫生簽發嘅 DNACPR Order，但效力期已過。'],dispute:['88 歲伯伯，晚期 COPD，喺床上冇反應','兒子出示有效嘅 DNACPR Order（表格一）；女兒哭著話「阿爸上個禮拜同我講佢想繼續生存，已經反口！」']}[v.k];
      const noCPR=v.k==='valid'; return {who:{valid:'78 歲伯伯',choke:'76 歲伯伯',expired:'85 歲伯伯',dispute:'88 歲伯伯'}[v.k],call:T[0]+'。',v:{hr:0,sbp:0,dbp:0,rr:0,spo2:0,avpu:3,gcs:3,rbs:6,pain:0,rhythm:'asys'},
      steps:[S('RSE','到場',T[0]+'。'+T[1],'到場見到有人出示 DNACPR Order，點分工？',['分工合作：一人檢查病人呼吸脈搏，一人查核命令','全部人睇份文件先','即刻 CPR 唔理文件','叫家屬出去'],'流程：到場已出示命令 → 分工合作：檢查病人呼吸脈搏、查核命令。'),
        S('CAB','檢查呼吸脈搏','冇呼吸、冇脈搏。','冇脈搏，下一步？',['查核命令是否「有效」及「適用」','即刻停止所有處理','叫警察','等醫生'],'見到命令 + 命令有效及適用 + 冇懷疑 = 不須施救。',{reveal:['hr','rr']}),
        S('HX','查核命令',T[1],'呢份命令點判斷？',noCPR?['有效及適用：不作 CPR，送最近醫院並通知留位，安慰家屬','無效：照做 CPR','要搜查病人身上有冇其他文件','叫家屬自己決定']:v.k==='choke'?['不適用：哽塞屬非自然因由，要施救','有效適用，唔使救','要先等警察確認','叫家屬決定']:v.k==='expired'?['無效：已過效力期，要施救','有效，唔使救','過期一日冇所謂','叫醫生延期']:['有理由懷疑已撤銷：立即施救，詳細記錄現場情況','跟文件，唔使救','叫兩位家屬投票','等律師'],'有效：訂明表格正本或核證副本、妥為填寫簽署、效力期未過（最長一年）、冇撤銷。適用：心肺停頓唔係非自然因由或傷害所致。「如有懷疑，救人第一」。'),
        noCPR?LG('不作 CPR。','之後點做？',['將病人送往最近醫院並通知醫院留位','留低病人喺屋企','叫殯儀','繼續 CPR'],'命令有效及適用 → 不作心肺復甦術，將病人送往最近醫院並通知醫院留位。')
        :S('CPR','開始心肺復甦','開始 CPR。','之後點做？',['繼續 CPR + AED，送最近醫院並通知留位','做 5 分鐘就停','唔使送院','等家屬同意'],'命令無效或不適用 → 開始 CPR，將病人送往最近醫院並通知醫院留位。'),
        ...(noCPR?[]:[LG('Moving CPR 上車。')])],
      hosp:H(null,['長者，心跳驟停',T[1],'冇呼吸脈搏',noCPR?'DNACPR Order 有效及適用，冇做 CPR':'命令'+(v.k==='choke'?'不適用（非自然因由）':v.k==='expired'?'無效（過期）':'有懷疑已撤銷')+'，已做 CPR'])}; } });
  /* ================= 創傷 ================= */
  L.push({id:'hat',ic:'🩹',cat:'傷',title:'止血帶',en:'Haemostatic Arterial Tourniquet',
    vars:[{k:'leg',label:'大腿大出血 → HAT'},{k:'groin',label:'腹股溝出血 → 唔可以用 HAT'},{k:'second',label:'第一條止唔到血'}],
    make(v){ return {who:'35 歲男工人',call:'工廠有工人被機器割傷，大量出血。',v:{hr:128,sbp:88,dbp:54,rr:24,spo2:95,avpu:0,gcs:15,rbs:6,pain:8,rhythm:'tachy'},
      steps:[...BB({rse:'機器已關、環境安全；'+(v.k==='groin'?'腹股溝':'左大腿')+'大量噴血。',rseQ:{q:'見到危及生命嘅大出血，即刻要？',o:['盡快止血：直接加壓','先量血壓','先填表','先問病史'],a:0,why:'嚴重出血要盡快處理。'},loc:[0,'清醒，好驚。'],d:[0,'冇撞頭、冇頸痛。'],cab:'橈動脈弱而快 128 次；呼吸 24 次。',o2:['nrm','SpO₂ 95%。',98],rbs:'直接加壓都止唔到血。',skin:'蒼白、濕冷。',shock:1,dec:[1,'危及生命嘅出血、休克。']}),
        S('BLEED','評估止血帶',v.k==='groin'?'出血位喺腹股溝（交界處）。':'大腿中段傷口，直接壓力止唔到血；傷口上方有足夠空間。','可唔可以用 HAT？',v.k==='groin'?['唔可以：交界處冇安全位置，改用止血敷料 (HD)','可以紮喺腹股溝','紮喺腰','紮喺膝頭']:['可以：危及生命肢體出血、直接加壓無效、有安全空間','唔可以','要醫生批准','只可以紮喺膝頭'],'HAT 適用：危及生命／嚴重肢體出血 + 直接壓力無效 + 有足夠安全空間（頭、頸、軀幹或任何關節都唔係安全位置）。'),
        v.k==='groin'?S('BLEED','止血敷料','可以識別明顯出血點。','HD 點用？',['將止血敷料按壓入傷口接觸出血點，按壓最少 3 分鐘，尾部留喺傷口外','鋪喺表面就得','填入腹腔','唔使按'],'交界處（頸、腋、腹股溝）出血用 HD 特別有用；按壓最少 3 分鐘；尾部留外提醒醫護。',{set:{hr:118}})
        :S('BLEED','紮止血帶位置','傷口喺大腿中段。','止血帶紮喺邊？',['傷口近端（向心臟方向）≥ 5 cm，盡量靠近傷口，離關節 ≥ 5 cm','直接紮喺傷口上','傷口遠端','紮喺膝頭'],'≥ 5 cm 近端（唔係遠端）、盡可能靠近傷口；離關節 ≥ 5 cm；唔好直接紮喺傷口；要夠緊阻止動脈流動。',{set:{hr:116}}),
        ...(v.k==='second'?[S('BLEED','第一條止唔到血','第一條紮好，仍然出血。','點做？',['喺第一條旁邊並排紮第二條；仍止唔到就考慮止血敷料','放鬆第一條','紮喺遠端','唔使理'],'第二條可並排靠近第一條；太近關節就紮喺關節上方肢體段；再止唔到就考慮止血敷料。')]:[]),
        S('TX','記錄同其他','出血已控制。','仲要做咩？',['記錄止血帶位置同時間（eAJR）並交接；留意 Hypovolemia／TXA／創傷中心、適當止痛','唔使記錄','放鬆止血帶睇吓','冰敷'],'將使用止血帶嘅位置和時間記錄到 eAJR，交接時通知醫護人員。'),
        LG('上車床。')],
      hosp:H(null,['35 歲男，機器割傷'+(v.k==='groin'?'腹股溝':'左大腿'),'危及生命出血，直接加壓無效；休克','BP 88／54 · HR 128 → '+(v.k==='groin'?118:116),v.k==='groin'?'止血敷料按壓 3 分鐘':'HAT'+(v.k==='second'?' × 2':'')+'（時間已記錄）'+'、NRM'])}; } });
  L.push({id:'hd',ic:'🧻',cat:'傷',title:'止血敷料',en:'Haemostatic Dressing',
    vars:[{k:'neck',label:'頸部出血'},{k:'chest',label:'胸腔大傷口睇唔到出血點'},{k:'eye',label:'眼球傷口 → 禁用'}],
    make(v){ const pos={neck:'頸側',chest:'胸口',eye:'眼'}[v.k]; return {who:'28 歲男子',call:'有 28 歲男子被玻璃割傷'+pos+'，大量出血。',v:{hr:122,sbp:94,dbp:58,rr:24,spo2:95,avpu:0,gcs:15,rbs:6,pain:7,rhythm:'tachy'},
      steps:[...BB({rse:'餐廳，玻璃碎已清理。',loc:[0,'清醒。'],d:[0,'冇跌倒。'],cab:'橈動脈 122 次；呼吸 24 次。',o2:['nrm','SpO₂ 95%。',98],rbs:pos+'傷口大量出血，直接加壓未能控制。',skin:'蒼白。',shock:1,dec:[1,'危及生命出血。']}),
        S('BLEED','評估止血敷料',v.k==='neck'?'頸側傷口，可以識別出血點，止血帶唔可以用。':v.k==='chest'?'胸口大傷口，睇唔到確切出血點。':'出血位喺眼球。','可唔可以用 HD？',v.k==='neck'?['可以：交界處出血、可識別出血點','唔可以','用止血帶紮頸','鋪紗布就得']:['唔可以（禁忌），用一般方法處理','可以塞入去','可以鋪滿','用止血帶'],'HD 禁忌：眼球、大腦、脊椎等結構；胸腹大傷口睇唔到確切出血點（唔好盲目包紮）。'),
        ...(v.k==='neck'?[S('BLEED','使用','準備好。','點用？',['換一副乾淨手套，將敷料按入傷口接觸出血點，按壓最少 3 分鐘，尾部留外','鋪喺表面','按 30 秒','唔使手套'],'按壓最少 3 分鐘；尾部留外；空包裝交醫護，記錄用咗幾多袋。',{set:{hr:112}})]:[]),
        LG('上車床。')],
      hosp:H(null,['28 歲男，玻璃割傷'+pos,'大量出血，直接加壓未能控制','BP 94／58 · HR 122'+(v.k==='neck'?' → 112':''),v.k==='neck'?'止血敷料按壓 3 分鐘（用咗 1 袋）':'直接加壓（HD 禁忌）'])}; } });
  L.push({id:'tpod',ic:'🦴',cat:'傷',title:'骨盆固定帶',en:'T-POD',
    vars:[{k:'supine',label:'仰臥病人'},{k:'prone',label:'俯臥病人'},{k:'kid',label:'< 23 kg 小童 → 禁用'}],
    make(v){ const who=v.k==='kid'?'5 歲男童（18 kg）':'40 歲女子'; return {who,call:'有'+who+'被私家車撞到，盤骨好痛。',v:{hr:118,sbp:96,dbp:60,rr:24,spo2:96,avpu:0,gcs:15,rbs:6,pain:8,rhythm:'tachy'},
      steps:[...BB({rse:'交通意外現場，警察已封路。病人'+(v.k==='prone'?'伏喺地上。':'仰臥。'),loc:[0,'清醒。'],d:[1,'被車撞，背痛。'],cab:'橈動脈 118 次；呼吸 24 次。',o2:['nrm','SpO₂ 96%。',98],rbs:'輕按盆骨有觸痛，下肢無力。',rbsQ:{q:'盆骨創傷要注意咩？',o:['可能有嚴重內出血，盡量少移動盆骨','用力搖盤骨檢查','叫病人企起','冇大問題'],a:0,why:'盆骨創傷可能有嚴重內出血，死亡率高；盡量少移動盆骨。'},skin:'蒼白。',shock:1,dec:[1,'嚴重創傷。']}),
        S('SPL','T-POD 適用症',v.k==='kid'?'18 kg。':'MOI 同表面徵狀懷疑骨盆受傷。','可唔可以用 T-POD？',v.k==='kid'?['唔可以：< 50 磅 (23 kg) 係禁忌','可以','剪細啲用','用兩條']:['可以','唔可以','要醫生批准','只限男性'],'T-POD 適用：MOI 及表面徵狀有骨盆受傷跡象；禁忌：< 50 磅 (23 kg)。'),
        ...(v.k==='kid'?[]:[S('SPL','位置',v.k==='prone'?'病人俯臥。':'病人仰臥，褲袋冇雜物。','T-POD 點放？',v.k==='prone'?['先上板（Load 上板）先落 T-POD','直接喺俯臥狀態綁','反轉病人再綁','唔使綁']:['腰帶上邊對準髂嵴或喺大轉子中心，中間留 6–8 吋空位，兩邊滑輪慢慢收緊','綁喺腰','綁喺膝頭','綁到最緊唔使留空位'],'3/4 prone 或 full prone 要上板先落 T-POD；腰帶對準大轉子中心，修剪後中間留 6–8 吋，裝滑輪慢慢收緊，記錄日期時間，再用彈性制動帶固定下肢。')]),
        LG('用剷床上車。')],
      hosp:H(null,[who+'，被私家車撞','盆骨觸痛，懷疑內出血','BP 96／60 · HR 118',v.k==='kid'?'剷床、少移動盆骨（T-POD 禁忌）':'T-POD（時間已記錄）、NRM'])}; } });
  L.push({id:'sager',ic:'🦵',cat:'傷',title:'牽引夾板',en:'Sager Traction Splint',
    vars:[{k:'closed',label:'閉合性中段股骨骨折'},{k:'open',label:'開放性骨折'},{k:'upper',label:'上 1/3 骨折'}],
    make(v){ return {who:'30 歲男子（70 kg ≈ 154 磅）',call:'有電單車司機大腿變形。',v:{hr:112,sbp:118,dbp:74,rr:22,spo2:97,avpu:0,gcs:15,rbs:6,pain:9,rhythm:'tachy'},
      steps:[...BB({rse:'路面，警察封路。',loc:[0,'清醒。'],d:[0,'戴頭盔、冇頸痛，NEXUS 評估後唔需要制動。'],cab:'橈動脈 112 次；呼吸 22 次。',o2:['nrm','SpO₂ 97%（重大創傷）。',99],rbs:'右大腿'+(v.k==='upper'?'上 1/3':'中段')+(v.k==='open'?'開放性':'閉合性')+'骨折，大腿明顯變形、縮短。',skin:'正常。',dec:[1,'長骨骨折。']}),
        S('SPL','檢查','準備用 Sager。','用夾板前要做咩？',['用手／沙包穩定肢體、展露包紮傷口、檢查遠端血液循環及神經功能（大 check）','直接拉','唔使檢查','先叫病人郁'],'先穩定、展露、包紮，再大 check。'),
        S('SPL','牽引力',v.k==='closed'?'閉合性中段骨折。':v.k==='open'?'開放性骨折。':'上 1/3 骨折。','用幾多牽引力？',v.k==='closed'?['體重 10%（約 15 磅），但最多 10 磅 → 10 磅','15 磅','5 磅','20 磅']:['最多 5 磅','10 磅','體重 10%','15 磅'],'閉合性中段：體重 10%，最大 10 磅；開放性骨折或關節損傷、上／下 1/3：最多 5 磅。'),
        S('SPL','之後','夾板裝好。','仲要做咩？',['複查遠端血液循環和神經功能，用剷床上車，檢查磅數升降唔超過 10%','唔使再查','放鬆夾板','叫病人企起'],'固定後複查（大 check），上剷床後再查磅數同循環。',{set:{pain:6}}),
        LG('用剷床上車。')],
      hosp:H(null,['30 歲男，電單車意外','右大腿'+(v.k==='upper'?'上 1/3':'中段')+(v.k==='open'?'開放性':'閉合性')+'骨折','BP 118／74 · HR 112','Sager '+(v.k==='closed'?'10 磅':'5 磅')+'、NRM'])}; } });
  L.push({id:'spinal',ic:'🦴',cat:'傷',title:'脊柱處理',en:'Spinal Management',
    vars:[{k:'walk',label:'清醒可自行走動、冇頸痛'},{k:'old',label:'≥ 65 歲'},{k:'drunk',label:'醉酒'},{k:'fall',label:'由 6 米以上墮下'}],
    make(v){ const who={walk:'25 歲男子',old:'70 歲婆婆',drunk:'35 歲男子',fall:'40 歲工人'}[v.k]; return {who,call:{walk:'有私家車追尾，司機自己落咗車。',old:'有 70 歲婆婆喺樓梯跌落嚟。',drunk:'有醉酒男子跌落樓梯。',fall:'有工人由 7 米高棚架墮下。'}[v.k],v:{hr:96,sbp:128,dbp:80,rr:20,spo2:97,avpu:0,gcs:15,rbs:6,pain:4,rhythm:'sinus'},
      steps:[...BB({rse:'現場安全。',loc:[0,v.k==='drunk'?'清醒但滿身酒味。':'清醒。'],d:[1,'根據 MOI 懷疑脊柱受傷。'],cab:'橈動脈 96 次；呼吸 20 次。',o2:['room','SpO₂ 97%。'],rbs:'冇明顯傷勢。',skin:'正常。',dec:[0,'冇危及生命嘅情況。']}),
        S('SPL','NEXUS：能否自行走動',v.k==='walk'?'病人警覺、清醒、可靠，自己行到救護車旁，冇頸痛。':'病人唔可以自行走動。','下一步？',v.k==='walk'?['無需脊柱制動，送院（持續頸痛先考慮頸套、平放擔架）','完整脊柱制動','叫佢跑兩步','上脊椎板']:['檢查有冇危及生命情況，冇就按經改良 NEXUS 準則逐項評估','叫佢自己行','即刻全套制動唔使評估','唔使理'],'可以自行走動：持續頸痛先考慮頸套並平放；否則無需制動。不能：先排除危及生命情況，再按經改良 NEXUS 準則。'),
        ...(v.k==='walk'?[]:[S('SPL','經改良 NEXUS 準則',{old:'70 歲。',drunk:'醉酒。',fall:'由 7 米高處墮下。'}[v.k],'點處理？',['完整的脊柱制動','無需制動','叫佢行吓','只上頸套']," NEXUS：< 12 或 ≥ 65 歲、神經缺損、脊柱觸痛／變形、清醒程度下降、中毒／醉酒、轉移注意力嘅傷、同車廂有死亡、被拋出車外、成人墮下 > 6 米（小童 > 3 米或身高兩倍）→ 完整脊柱制動。")]),
        LG('上車。')],
      hosp:H(null,[who,'MOI 懷疑脊柱受傷','生命表徵穩定',v.k==='walk'?'無需脊柱制動':'完整脊柱制動'])}; } });
  L.push({id:'burn',ic:'🔥',cat:'傷',title:'燒傷敷料',en:'Burn Kit',
    vars:[{k:'scald',label:'熱水燙傷 5%'},{k:'chem',label:'化學品燒傷'},{k:'face',label:'面部燒傷 → 吸入性損傷'},{k:'big',label:'面積 > 15%'}],
    make(v){ const D={scald:['熱水燙傷右手臂，約 5%，有水泡','5%'],chem:['工廠化學品濺到前臂','3%'],face:['廚房火警，面部燒傷、鼻毛燒焦','4%'],big:['火警，胸腹同雙手燒傷約 25%','25%']}[v.k]; return {who:'45 歲男子',call:'有 45 歲男子燒傷。',v:{hr:110,sbp:128,dbp:80,rr:v.k==='face'?26:20,spo2:v.k==='face'?93:98,avpu:0,gcs:15,rbs:6,pain:8,rhythm:'sinus'},
      steps:[...BB({rse:D[0]+'；危險已排除。',loc:[0,'清醒。'],d:[0,'冇跌倒。'],cab:'橈動脈 110 次；呼吸 '+(v.k==='face'?'26 次，聲沙':'20 次')+'。',o2:v.k==='face'||v.k==='big'?['nrm','SpO₂ '+(v.k==='face'?'93%':'98%')+'。',98]:['room','SpO₂ 98%，冇呼吸困難。'],rbs:'燒傷面積約 '+D[1]+'（九則計算法）。',rbsQ:{q:'估算燒傷面積用咩方法？',o:['九則計算法（Rule of Nines）','睇痛唔痛','量體溫','唔使估'],a:0,why:'成人用九則計算法，嬰兒小童另有比例。'},skin:'紅、水泡。',dec:[v.k==='face'||v.k==='big'?1:0,v.k==='big'?'嚴重燒傷。':v.k==='face'?'懷疑吸入性損傷。':'局部燒傷。']}),
        S('TX','冷水治療',v.k==='chem'?'化學品燒傷。':'燒傷後 5 分鐘。','點沖？',v.k==='chem'?['先用大量清水沖洗化學品，之後先用燒傷敷料','直接蓋燒傷敷料','用冰水','唔使沖']:['即場沖約 10 分鐘（燒傷後 10 分鐘內），唔好超過 10 分鐘','沖 30 分鐘','用冰','唔使沖'],'情況許可即場沖洗約 10 分鐘；唔可超過 10 分鐘以免體溫過低；化學品先沖水後用敷料（石灰可用大量清水）。'),
        S('TX','燒傷敷料',v.k==='big'?'燒傷約 25%。':v.k==='face'?'面部燒傷。':'一／二級燒傷 '+D[1]+'。','點用 Burnkit？',v.k==='big'?['唔可以全部蓋：Burnkit 唔可以覆蓋多過 15%，防體溫過低','全身蓋晒','用濕毛巾包住全身','唔使理']:v.k==='face'?['可以用，但唔好完全覆蓋口鼻；當吸入性損傷處理，俾高濃度氧氣','蓋晒成塊面','唔使氧氣','用冰敷']:['用燒傷敷料，唔好弄穿水泡','刺穿水泡先蓋','塗牙膏','唔使包紮'],'Burnkit 只適用於一或二級燒傷；唔可覆蓋多於 15% 體表面積；唔好完全覆蓋口鼻；避免弄穿水泡；化學品未沖淨唔可以敷。'),
        LG('上車床。')],
      hosp:H(null,['45 歲男，'+D[0],'燒傷約 '+D[1]+(v.k==='face'?'，懷疑吸入性損傷':''),'HR 110 · SpO₂ '+(v.k==='face'?'93% → 98%':'98%'),'冷水沖洗、'+(v.k==='big'?'局部敷料（≤ 15%）、保暖':'燒傷敷料')+(v.k==='face'||v.k==='big'?'、NRM':'')])}; } });
  L.push({id:'hypot',ic:'🥶',cat:'傷',title:'低溫症',en:'Hypothermia',
    vars:[{k:'imm',label:'浸水受寒'},{k:'cold',label:'冷凍受寒（山上）'},{k:'frost',label:'凍傷'}],
    make(v){ const D={imm:['有人遇溺，救起後全身濕透發冷','碼頭'],cold:['行山人士喺山頂迷路一晚，好凍','大帽山'],frost:['行山人士手指冰冷麻木、轉灰白','大帽山']}[v.k]; return {who:'50 歲男子',call:D[0]+'。',v:v.k==='frost'?{hr:88,sbp:132,dbp:82,rr:16,spo2:97,avpu:0,gcs:15,rbs:5.6,pain:5,rhythm:'sinus'}:{hr:56,sbp:104,dbp:66,rr:12,spo2:94,avpu:1,gcs:13,rbs:5,pain:3,rhythm:'brady'},
      steps:[...BB({rse:D[1]+'，風大、氣溫低。',loc:v.k==='frost'?[0,'清醒。']:[1,'講嘢含糊、動作唔協調。'],d:[0,'冇跌倒。'],cab:v.k==='frost'?'橈動脈 88 次、規則；呼吸 16 次。':'脈搏慢而唔規則，56 次；呼吸 12 次。',o2:v.k==='frost'?['room','SpO₂ 97%（用耳珠夾，手指凍讀數唔準）。']:['nc','SpO₂ 94%（指尖凍，讀數可能唔準）。',95],rbs:v.k==='frost'?'左手手指灰白、冇知覺。':'全身冰冷，'+(v.k==='imm'?'衣服濕透。':'衣著單薄。'),skin:v.k==='frost'?'左手手指灰白、冰冷、硬實；其他位置正常。':'蒼白、冰冷。',skinQ:v.k==='frost'?{q:'手指灰白、冰冷、硬實冇知覺，係？',o:['凍傷','燙傷','過敏','瘀傷'],a:0,why:'凍傷：皮膚灰白／蠟黃、冰冷、硬實、麻痺。要慢慢回暖，唔可以搓。'}:{q:'低溫症常見表現？',o:['面色蒼白、皮膚冰冷、說話含糊、脈搏慢而不規律','潮紅發熱','大量出汗','皮膚出疹'],a:0,why:'體溫過低：蒼白微涼、說話含糊、動作失協調，後期昏迷、皮膚冰冷、肌肉僵硬、脈搏緩慢不規律。'},dec:v.k==='frost'?[0,'清醒、生命表徵穩定，局部凍傷。']:[1,'低溫。']}),
        v.k==='frost'?S('TX','凍傷處理','手指凍傷。','點處理？',['利用體溫慢慢回暖（例如放入對側腋下），除下戒指，唔好搓、唔好用熱水袋','用熱水袋直接焗','用力搓暖','吸煙暖身'],'凍傷：逐漸回暖，用自身體溫；唔可用熱水袋或近火爐；唔可搓揉按摩；除去戒指或緊身衣物；勸阻吸煙。')
        :S('TX','保暖',v.k==='imm'?'衣服濕透。':'衣著單薄。','點處理？',v.k==='imm'?['脫去濕衣、擦乾，用 Hypothermia Wrap 程序包裹','加多幾件衫蓋住濕衫','用熱水袋直接貼身','搓暖手腳']:['提供遮蔽，用毛氈包裹（包埋頭但唔阻礙呼吸）','用熱水袋貼身','搓揉按摩','俾佢飲酒'],'切勿直接加熱、搓揉按摩或過度增加衣物；Hypothermia Wrap：脫濕衣 → 保溫毯 → 紅毯 → Hot Pack（放嘔吐袋、膠紙固定紅毯外）→ 第二張紅毯 → 救護袋床。'),
        S('TX','Hot Pack 注意','準備 Hot Pack。','點用 Hot Pack？',['放入嘔吐袋，唔可以直接接觸皮膚，最少隔一張紅毯，每 10–20 分鐘更換','直接貼皮膚','用完留返下次用','爆咗照用'],'Hot Pack 必須放入嘔吐袋；與皮膚最少隔一張紅毯；每 10–20 分鐘更換；一次性；破裂要換整袋，接觸皮膚即用清水沖。'),
        LG('上車床。',null,['LOAD & GO，途中持續以毛氈包裹；就算睇落似死亡都要繼續復甦直至醫生確認','脫晒毛氈','唔使送院','開冷氣'],'嚴重受寒可能看似死亡，救護人員必須持續急救與復甦，直至醫生確認死亡。')],
      hosp:H(null,['50 歲男，'+D[0],v.k==='frost'?'左手手指凍傷':'低溫：說話含糊、脈搏慢',v.k==='frost'?'HR 88 · SpO₂ 97%':'HR 56 · SpO₂ 94%',v.k==='frost'?'體溫回暖、除戒指':'Hypothermia Wrap、Hot Pack'])}; } });
  /* ================= 器材／準則 ================= */
  L.push({id:'ecg12',ic:'📈',cat:'準',title:'十二導聯心電圖',en:'12-Lead ECG',
    vars:[{k:'stemi',label:'有 STEMI 訊號'},{k:'gcs',label:'GCS ≦ 13 → 禁忌'},{k:'female',label:'女性病人私隱'},{k:'fail',label:'傳輸失敗'}],
    make(v){ const fem=v.k==='female'; return {who:fem?'60 歲女子':'64 歲男子',call:'有'+(fem?'60 歲女子':'64 歲男子')+'胸口痛。',v:{hr:92,sbp:134,dbp:84,rr:20,spo2:96,avpu:v.k==='gcs'?1:0,gcs:v.k==='gcs'?12:15,rbs:6,pain:7,rhythm:'sinus'},
      steps:[...BB({rse:'住宅，環境安全。',loc:v.k==='gcs'?[1,'答非所問。']:[0,'清醒。'],d:[0,'冇跌倒。'],cab:'橈動脈 92 次；呼吸 20 次。',o2:['room','SpO₂ 96%，冇呼吸困難。'],rbs:'冇傷勢。',skin:'冒汗。',dec:[1,'胸痛。']}),
        S('TX','12-Lead ECG 適用症',v.k==='gcs'?'≥ 12 歲、心源性胸痛，但 GCS 12。':'≥ 12 歲、心源性胸痛、生命表徵穩定。','可唔可以做？',v.k==='gcs'?['唔可以：GCS ≦ 13 係禁忌','可以','做一半','到院先做']:['可以，先講原因同取得口頭同意','唔使問就做','唔可以','只喺醫院做'],'禁忌：心臟驟停、無法處理氣道／呼吸、GCS ≦ 13、SBP < 90（或回流 > 2 秒）、RR < 10 或 > 29。病人唔同意就照常運送，唔好拖延。'),
        ...(v.k==='gcs'?[]:[fem?S('TX','女性病人','女性病人。','點做先尊重私隱？',['先接好電纜再貼電極、病人自己遮住乳房、唔好用手摸搵位置、貼完即覆蓋、做完請病人自己除 C1–C6','叫佢除晒衫','男同事用手搵肋骨位','唔使理私隱']," 女性病人特別注意事項：盡量減少暴露同身體接觸。")
          :S('TX','電極位置','準備貼電極。','C1 貼喺邊？',['第 4 肋間隙，右側胸骨旁','第 5 肋間隙，左腋中線','左鎖骨下','右肋緣'],'C1 第 4 肋間右胸骨旁；C2 第 4 肋間左胸骨旁；C3 C2 同 C4 之間；C4 第 5 肋間左鎖骨中線；C5 C4 同 C6 之間；C6 第 5 肋間左腋中線。'),
          S('TX','傳送',v.k==='fail'?'傳輸失敗。':v.k==='stemi'?'傳輸成功，出現「STEMI」訊號。':'傳輸成功，冇 STEMI。','之後點做？',v.k==='stemi'?['致電接收醫院急症室，通知已傳送 ECG 及正運送危重病人（身份證、救護車編號、預計到達時間、手機號碼）','唔使通知','叫病人自己打俾醫生','重做 10 次']:v.k==='fail'?['記錄原因，繼續運送同監察，唔好因 ECG 耽誤治療','留喺現場一直重試','停止所有治療','唔使記錄']:['保留 R、L、F、N 監察電極，移除 C1–C6，繼續監察同送院','除晒所有電極','停止監察','叫病人自己行'],'任何情況唔得因 12-Lead ECG 耽誤治療；有 STEMI 要致電接收醫院；e-AJR 要記錄有冇 STEMI、有冇送出、有冇通知醫院、有冇交 CCPP 表格 (FSG 343)。')]),
        LG('上車床。')],
      hosp:H(null,[(fem?'60 歲女':'64 歲男')+'，胸口痛','心源性胸痛'+(v.k==='gcs'?'，GCS 12':''),'BP 134／84 · HR 92',v.k==='gcs'?'冇做 12-Lead（GCS ≦ 13）':'12-Lead ECG'+(v.k==='stemi'?'：STEMI，已通知醫院':v.k==='fail'?'：傳輸失敗，已記錄':'')+'、CCPP 表格'])}; } });
  L.push({id:'stroke',ic:'🧠',cat:'準',title:'院前中風通報及分流',en:'Pre-hospital Stroke',
    vars:[{k:'notify',label:'符合 → 通報'},{k:'hypo',label:"H'stix ≦ 4 → 先處理低血糖"},{k:'late',label:'超過 4 小時 → 唔使評估'}],
    make(v){ const r=v.k==='hypo'?3.1:6.4; return {who:'68 歲男子',call:'有 68 歲男子突然右手無力、講嘢唔清。',v:{hr:88,sbp:168,dbp:96,rr:18,spo2:97,avpu:0,gcs:14,rbs:r,pain:0,rhythm:'sinus'},
      steps:[...BB({rse:'住宅，環境安全。',loc:[0,'清醒，講嘢含糊。'],d:[0,'冇跌倒。'],cab:'橈動脈 88 次；呼吸 18 次。',o2:['room','SpO₂ 97%。'],rbs:'右手右腳無力、口角歪。',skin:'正常。',dec:[1,'突發單邊無力。']}),
        S('HX','病發時間',v.k==='late'?'家人話佢琴晚瞓前（約 9 小時前）仲正常，今朝先發現。':'太太話 1 小時前食飯時突然發生。','院前中風評估適用症係？',['突發單邊肢體無力或語言障礙，及病發／最後正常時間 4 小時內','任何頭暈','只要血壓高','24 小時內'],'不符合任何條件就唔使評估（唔使交表）。'),
        S('HS',"檢查 H'stix","H'stix："+r+' mmol/L',"點處理？",v.k==='hypo'?['先按 Glycemia Protocol 處理低血糖，再做中風評估','照做中風通報','唔使理血糖','俾 ASA']:['已排除低血糖 (> 4.0)，繼續評估','先俾糖水','俾 Glucagon','停止評估'],"通報條件包括已排除血糖過低 (H'stix > 4.0)；應先處理血糖過低才進行中風評估。",{reveal:['rbs']}),
        VS('BP 168／96 · HR 88 · RR 18 · SpO₂ 97% · GCS 14'),
        v.k==='notify'?S('TX','FAST-ED','面部單側下垂、一邊手抬唔起、講到 1 樣動物、雙眼偏向一面但提示下望到另一面、知道手無力。','FAST-ED 總分係？',['5 分','2 分','9 分','0 分'],'F 1 + A 2（一邊完全唔能抬高）+ S 1（只講出 0–1 樣）+ E 1 + D 0 = 5。通報條件：≥ 18 歲、非長期臥床、SBP > 100 及 GCS ≥ 8、H\'stix > 4。')
        :S('TX','決定',v.k==='late'?'已超過 4 小時。':"H'stix 3.1。",'需唔需要院前中風通報？',v.k==='late'?['唔需要：病發超過 4 小時，如常送院','需要','需要並分流','叫家人決定']:['暫時唔可以：先處理低血糖再評估','需要即刻通報','唔使理','送私家醫院'],'唔符合條件 → 如常送院。'),
        v.k==='notify'?S('CALL','通報',HOSP()+'屬區。','點做？',['直接致電院前中風通報電話，強調係院前中風通報，提供資料，到院後交表','唔使通報','叫控制室傳話','到院先講'],'被評定有機會中風及適合溶栓嘅病人，主管應盡快通知所屬醫院急症室並盡快送院；到院提交表格。'):LG('上車床。'),
        ...(v.k==='notify'?[LG('上車床。')]:[])],
      hosp:H(null,['68 歲男，突發右邊無力、講嘢含糊','病發 '+(v.k==='late'?'約 9 小時前':'1 小時前')+"；H'stix "+r,'BP 168／96 · GCS 14',v.k==='notify'?'FAST-ED 5 分，已院前中風通報':v.k==='hypo'?'先處理低血糖':'超過 4 小時，如常送院'])}; } });
  L.push({id:'trauma',ic:'🏥',cat:'準',title:'創傷分流',en:'Trauma Diversion',
    vars:[{k:'gcs',label:'GCS 12 → 創傷中心'},{k:'arrest',label:'心臟驟停 → 最就近醫院'},{k:'fall',label:'由 8 米墮下'},{k:'minor',label:'冇高危因素 → 屬區醫院'}],
    make(v){ const D={gcs:['電單車撞車，頭部受傷','GCS 12',12],arrest:['被車撞，冇呼吸脈搏','心臟驟停',3],fall:['工人由 8 米高墮下','GCS 15',15],minor:['單車跌倒擦傷手肘','GCS 15',15]}[v.k]; return {who:'成年男子',call:D[0]+'。',v:{hr:v.k==='arrest'?0:100,sbp:v.k==='arrest'?0:122,dbp:v.k==='arrest'?0:78,rr:v.k==='arrest'?0:20,spo2:v.k==='arrest'?0:97,avpu:v.k==='arrest'?3:v.k==='gcs'?1:0,gcs:D[2],rbs:6,pain:5,rhythm:v.k==='arrest'?'asys':'sinus'},
      steps:[S('RSE','到場',D[0]+'。','創傷分流第一條問題係？',['病人係咪心臟驟停','傷口有幾長','病人住邊','有冇買保險'],'創傷分流：心臟驟停 → 最就近醫院；氣道／呼吸未能有效處理 → 最就近醫院。'),
        S('LOC','評估',D[1]+'。','呢個情況屬於？',v.k==='arrest'?['心臟驟停 → 最就近醫院','創傷中心','屬區醫院','私家醫院']:v.k==='gcs'?['GCS 3–13 → 創傷中心','屬區醫院','最就近醫院','唔使送院']:['GCS 14–15 → 繼續查看其他準則','即刻創傷中心','最就近醫院','唔使送院'],'GCS 3–13 → 創傷中心；14–15 繼續查看收縮壓、呼吸頻率、墮下高度、高風險致傷過程同受傷部位。',{reveal:['avpu']}),
        ...(v.k==='arrest'||v.k==='gcs'?[]:[S('HOSP','繼續查看',v.k==='fall'?'由 8 米高處墮下；SBP 122、RR 20。':'SBP 122、RR 20；冇墮下、冇拋出車外、冇槍傷、冇槤枷胸、冇兩條或以上股骨／脛骨骨折、冇斷肢、冇穿透性傷、冇癱瘓、冇盤骨骨折、冇 ≥ 20% 燒傷。','送邊？',v.k==='fall'?['創傷中心（成人由 6 米以上墮下）','屬區醫院','最就近醫院','私家醫院']:['屬區醫院','創傷中心','最就近醫院','唔使送院'],'成人墮下 > 6 米、小童 > 3 米或身高兩倍 → 創傷中心；全部準則都唔符合 → 屬區醫院。')]),
        LG('上車。',HOSP()==='屯門醫院'?'新界西嘅創傷中心係邊間？':'新界東嘅創傷中心係邊間？',HOSP()==='屯門醫院'?['屯門醫院','博愛醫院','天水圍醫院','明愛醫院']:['威爾斯親王醫院','沙田醫院','北區醫院','大埔那打素醫院'],'創傷中心：瑪麗、東區尤德夫人那打素、伊利沙伯、瑪嘉烈、屯門、威爾斯親王。')],
      hosp:H(null,['成年男子，'+D[0],D[1],v.k==='arrest'?'持續 CPR':'生命表徵穩定',{gcs:'送創傷中心',arrest:'送最就近醫院',fall:'送創傷中心（> 6 米墮下）',minor:'送屬區醫院'}[v.k]])}; } });
  L.push({id:'lvad',ic:'🔋',cat:'準',title:'左心室輔助器',en:'LVAD',
    vars:[{k:'stable',label:'摸唔到脈搏但清醒'},{k:'arrest',label:'冇脈搏、GCS 111、RR 0'}],
    make(v){ const ar=v.k==='arrest'; return {who:'55 歲男子（裝有 LVAD）',call:'有裝有 LVAD 嘅 55 歲男子'+(ar?'暈低冇反應。':'頭暈。'),v:{hr:ar?0:84,sbp:ar?0:84,dbp:0,rr:ar?0:18,spo2:ar?0:95,avpu:ar?3:0,gcs:ar?3:15,rbs:6,pain:0,rhythm:ar?'vf':'sinus'},
      steps:[S('RSE','到場','屋企，太太話佢裝咗 LVAD，有使用手冊同瑪麗醫院電話。','接觸 LVAD 病人要注意咩？',['系統控制器同電線唔可以分開，唔好牽拉扭轉，剪衫小心電線，避免弄濕','可以拔電線方便搬','唔使理部機','淋水降溫'],'任何情況下系統控制器及電線均不能分開；處理時不可牽拉或扭轉電線。'),
        S('CAB','摸脈搏',ar?'摸唔到脈搏；GCS 1-1-1；冇呼吸（瀕死呼吸）。':'摸唔到脈搏，但病人清醒、對答正常。','點判斷？',ar?['心臟驟停（冇脈搏 + GCS 111 + RR 0）→ CPR + AED，通知 CTSD of QMH','LVAD 病人正常摸唔到脈，唔使理','只俾氧','等醫生']:['LVAD 提供連續血流，極難摸到脈搏，唔代表心臟停頓','即刻 CPR','即刻 AED','叫警察'],'LVAD 病人心臟驟停定義：冇脈搏、GCS = 111、RR = 0（瀕死呼吸）。',{reveal:['hr','rr']}),
        ...(ar?[CPRQ(55)]:[S('VS','量維生指數','血壓計量唔到穩定讀數。','LVAD 病人用咩取代量血壓？',['遠端血液回流灌注：> 2 秒取代 SBP < 90；≦ 2 秒取代 SBP ≧ 90','唔使量','量體溫','量血糖'],'LVAD：[遠端血液回流灌注] 取代 [量度血壓]。',{reveal:['spo2']})]),
        S('CALL','通知',ar?'已開始 CPR。':'準備送院。','要通知邊個？',['正前往嘅 A&E 及瑪麗醫院心胸外科（如屬瑪麗醫院病人）','唔使通知','通知病人公司','通知電視台'],'通知正前往嘅 A&E 及瑪麗醫院（如屬瑪麗醫院病人）；LVAD 電話 2255 5808／5807／5837。'),
        LG('上車，控制器同電池一齊帶。')],
      hosp:H(null,['55 歲男，裝有 LVAD',ar?'冇脈搏、GCS 111、RR 0':'摸唔到脈搏但清醒',ar?'持續 CPR':'回流灌注 ≦ 2 秒',ar?'CPR + AED，已通知 QMH CTSD':'已通知 A&E 及瑪麗醫院'])}; } });
  // DECISION：穩定 = 冇生命危險；行到 Protocol 一律屬不穩定 → 有藥幫到就喺現場俾埋藥先上車，冇藥就立即上車
  const DRUG=new Set(['asa','ntg','salb','ipra','d10','ns','thia','gluc','nalox','charc','mida','jext','piri','trama','txa','olz','penth','adr','amio']);
  function decFix(l,m){ const i=m.steps.findIndex(x=>x.k==='DEC'); if(i<0) return m;
    const used=[]; for(const x of m.steps.slice(i+1)){ if(x.k==='LG') break; if(typeof SIMTOOLS==='undefined') break; SIMTOOLS.need(x,l.id).forEach(g=>g.forEach(id=>{ if(DRUG.has(id)&&!used.includes(id)) used.push(id); })); if(/處理低血糖/.test((x.q&&x.q.o[0])||'')&&!used.includes('d10')) used.push('d10'); }
    const names=used.map(id=>SIMTOOLS.T[id][1]); const drug=used.length>0;
    const A='不穩定：現場有藥幫到佢 → 喺現場先俾藥，之後先上車', B='不穩定：現場冇藥幫到佢 → 立即上車 (LOAD & GO)', C='穩定：冇生命危險，可以喺現場慢慢詳細檢查', D='穩定：唔使送院';
    const old=m.steps[i], why='穩定 = 冇生命危險。行到 Protocol 嘅病人全部屬於不穩定，要諗吓有冇藥幫到佢：有就喺現場俾埋藥先上車；冇就立即上車走。'+(drug?'今次可以喺現場用：'+names.join('、')+'。':'今次現場冇藥可以幫到佢，處理完必要嘅氣道、呼吸、止血就上車。');
    m.steps[i]={k:'DEC',act:'決定：穩定定不穩定？有冇藥幫到佢？',find:'初步評估完成：'+String(old.find||'').replace(/[、，]?生命表徵穩定/g,'').replace(/穩定/g,'').replace(/[，、：]\s*。$/,'。'),q:{q:'病人屬於穩定定不穩定？下一步點做？',o:drug?[A,B,C,D]:[B,A,C,D],a:0,why},e:{q:'行到 Protocol 嘅病人屬於？下一步？',o:drug?[A,B,C]:[B,A,C],a:0,why}};
    m.decDrug=drug;
    // 冇藥俾：救命處理（止血、氣道、固定、保溫、燒傷降溫）做完就上車，其餘（病史、維生指數、血糖、ECG、通報…）搬去車上做
    if(!drug){ const j=m.steps.findIndex((x,n)=>n>i&&x.k==='LG'); if(j>i+1){ const KEEP=new Set(['tq','hd','gauze','splint','sager','tpod','collar','board','burn','water','foil','wrap','hotpack','bvm','opa','npa','suction','lt','lma','combi','aed','accm']);
      const mid=m.steps.slice(i+1,j), stay=[], move=[];
      mid.forEach(x=>{ const ids=typeof SIMTOOLS!=='undefined'?SIMTOOLS.need(x,l.id).flat():[]; (['BLEED','AW','CPR','AED','SPL'].includes(x.k)||ids.some(id=>KEEP.has(id))?stay:move).push(x); });
      if(move.length){ move.forEach(x=>{ x.act='（車上）'+x.act; }); m.steps=[...m.steps.slice(0,i+1),...stay,m.steps[j],...m.steps.slice(j+1)]; m.hosp=[...move,...m.hosp]; } } }
    // 上車之後嘅步驟一律喺車上做
    { const j=m.steps.findIndex((x,n)=>n>i&&x.k==='LG'); if(j>=0&&j<m.steps.length-1){ const after=m.steps.slice(j+1); after.forEach(x=>{ if(!/^（車上）/.test(x.act||'')) x.act='（車上）'+x.act; }); m.steps=m.steps.slice(0,j+1); m.hosp=[...after,...m.hosp]; } }
    return m; }
  L.forEach((l,i)=>{ l.lv=i; const mk=l.make; l.make=v=>decFix(l,mk.call(l,v)); });
  return L;
})();

/* ---------- 🎬 現場模擬動畫：救護員動作、器材道具、病人呼吸／抽搐／CPR、對白氣泡、電影鏡頭 ---------- */
const SIMAN=(()=>{
  const V=(x,y,z)=>new THREE.Vector3(x,y,z);
  // 病人（躺平）group 本地座標：頭 z≈-0.9、胸 z≈-0.2、盆骨 z≈0.6、腳 z≈1.1；正面向上 y≈1.0
  const PT={head:V(0,0.55,-0.9),face:V(0,1.12,-0.82),mouth:V(0,1.06,-0.66),neck:V(0,0.78,-0.45),chest:V(0,1.02,-0.2),belly:V(0,1.0,0.3),pelvis:V(0,0.98,0.6),armL:V(0.62,0.66,-0.05),wristL:V(0.62,0.84,0.25),armR:V(-0.62,0.66,-0.05),thighL:V(0.21,0.62,0.92),thighR:V(-0.21,0.62,0.92),shinR:V(-0.21,0.6,1.1),shinL:V(0.21,0.6,1.1)};
  const pw=k=>patient.localToWorld(PT[k].clone());
  const C=()=>crew.userData;
  const onP=[], onG=[];   // 病人身上（跟病人上車）／地上（離開現場就收走）
  let WHO='', MARKS=null; const MK_Y={armL:0.13,armR:0.13,thighL:0.2,thighR:0.2}; const honor=()=>{ const w=WHO; const age=+((w.match(/(\d+)\s*歲/)||[])[1]||40), f=/女|婆|太|孕|媽/.test(w); if(age<12||/童|嬰/.test(w)) return '小朋友'; if(age>=65) return f?'婆婆':'伯伯'; return f?'小姐':'先生'; };
  function setCase(sc){ WHO=(sc&&sc.who)||''; MARKS=(sc&&sc.marks)||null; CASE=sc||null; }
  let act=null, at=0, cpr=false, ventOn=false, shockAt=-1, jolt=0, camA=0.6, focus='chest', fx=[];
  const mat=(c,o={})=>{ const m=new THREE.MeshStandardMaterial({color:c,roughness:o.r??0.5,metalness:o.m??0,transparent:!!o.op,opacity:o.op??1,emissive:o.e||0,depthWrite:o.op?false:true}); return m; };
  function onPat(geo,m,k,dx=0,dy=0,dz=0,rx=0,ry=0,rz=0,name){ const p=PT[k]; const o=add(geo,m,patient,p.x+dx,p.y+dy,p.z+dz,false); o.rotation.set(rx,ry,rz); o.userData.sim=name||1; onP.push(o); return o; }
  function onGround(geo,m,k,side,fwd,y,name){ const P=pw(k), a=patient.rotation.y; const rx=Math.cos(a), rz=-Math.sin(a), fx_=Math.sin(a), fz=Math.cos(a);   // patient 本地 x 方向同 z 方向（世界）
    const o=add(geo,m,scene,P.x+rx*side+fx_*fwd,y,P.z+rz*side+fz*fwd); o.rotation.y=a; o.userData.sim=name||1; onG.push(o); return o; }
  const has=n=>onP.concat(onG).find(o=>o.userData.sim===n);
  /* ----- 對白氣泡 ----- */
  function bubble(target,text,dur=2.6,color='#ffffff'){ if(!text) return; const c=document.createElement('canvas'); c.width=512; c.height=128; const g=c.getContext('2d');
    g.font='800 40px "PingFang HK","Noto Sans TC","Microsoft JhengHei",sans-serif'; const w=Math.min(500,g.measureText(text).width+48);
    g.fillStyle='rgba(12,16,24,.88)'; rr(g,(512-w)/2,10,w,84,22); g.fill(); g.beginPath(); g.moveTo(240,92); g.lineTo(272,92); g.lineTo(256,118); g.fill();
    g.fillStyle=color; g.textAlign='center'; g.textBaseline='middle'; g.fillText(text,256,53,480);
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthTest:false,transparent:true})); s.scale.set(2.6,0.65,1); s.renderOrder=20; scene.add(s);
    fx.push({o:s,t:0,d:dur,f:(o,k)=>{ const p=typeof target==='function'?target():target; o.position.copy(p).add(V(0,0.35+k*0.25,0)); o.material.opacity=k<0.85?1:(1-k)/0.15; }}); }
  const crewHead=c=>()=>c.getWorldPosition(V()).add(V(0,c.position.y>-0.2?3.1:2.7,0));
  const patHead=()=>pw('head').add(V(0,1.0,0));
  /* ----- 救護員位置 ----- */
  function place(c,wp,lookAt,kneel=true){ const L=crew.worldToLocal(wp.clone()); c.position.set(L.x,kneel?-0.38:0,L.z); const yaw=Math.atan2(lookAt.x-wp.x,lookAt.z-wp.z); c.rotation.set(0,yaw-crew.rotation.y,0); }
  const off=(k,side,fwd)=>{ const P=pw(k), a=patient.rotation.y; return V(P.x+Math.cos(a)*side+Math.sin(a)*fwd,0.15,P.z-Math.sin(a)*side+Math.cos(a)*fwd); };
  function posCrew(){ const {c1,c2}=C(); place(c1,off('head',0,-1.15),pw('head')); place(c2,off('chest',1.25,0.15),pw('chest')); crew.userData.st.visible=false; }
  function restore(){ const {c1,c2,st}=C(); c1.position.set(0,0,2.3); c1.rotation.set(0,Math.PI,0); c2.position.set(0,0,-2.3); c2.rotation.set(0,0,0); [c1,c2].forEach(c=>c.userData.arms.forEach(a=>{ a.rotation.set(-0.8,0,0); })); st.visible=true; P().rotation.z=0; P().position.set(0,0.5,1.2); torso().scale.set(1,1,1); }
  const P=()=>patient.userData.p; const torso=()=>P().children[0];
  /* ----- 道具 ----- */
  const ECGT=(()=>{ const cv=document.getElementById('simEcg'); return cv?new THREE.CanvasTexture(cv):null; })();
  const G={
    o2cyl(){ if(has('cyl')) return; const g=new THREE.Group(); g.userData.sim='cyl'; const P0=off('head',-0.9,-0.4); g.position.copy(P0); g.position.y=0; scene.add(g); onG.push(g);
      add(cyl(0.12,0.12,0.9,14),mat(0x2e8b57,{m:0.4,r:0.3}),g,0,0.45,0); add(cyl(0.12,0.08,0.12,14),mat(0xf2f2f2),g,0,0.96,0); add(cyl(0.03,0.03,0.12,8),mat(0x9aa1a9,{m:0.8}),g,0,1.08,0); },
    mask(type){ onP.filter(o=>o.userData.sim==='mask'||o.userData.sim==='nc'||o.userData.sim==='res').forEach(o=>{ o.parent.remove(o); }); for(let i=onP.length-1;i>=0;i--) if(['mask','nc','res'].includes(onP[i].userData.sim)) onP.splice(i,1);
      if(type==='none') return; G.o2cyl();
      if(type==='nc'){ onPat(new THREE.TorusGeometry(0.34,0.018,6,24),mat(0xe8f4ff,{op:0.9}),'face',0,0.02,0.05,Math.PI/2,0,0,'nc'); return; }
      const m=onPat(new THREE.SphereGeometry(0.3,16,10,0,Math.PI*2,0,Math.PI/2),mat(type==='ven'?0x8fd3ff:0x9ee6b8,{op:0.55}),'face',0,0.0,0.05,0,0,0,'mask'); m.scale.set(1,0.7,1.1);
      if(type==='nrm') onPat(sph(0.22),mat(0x9ee6b8,{op:0.6}),'chest',0.25,0.1,-0.15,0,0,0,'res'); },
    bvm(){ if(has('bvm')) return; const b=onPat(sph(0.24),mat(0x2f6fe8,{op:0.85}),'face',0,0.42,-0.3,0,0,0,'bvm'); b.scale.set(1,1,1.6); G.mask('mask'); },
    monitor(){ if(has('mon')) return; const g=new THREE.Group(); g.userData.sim='mon'; const P0=off('chest',-1.15,-0.3); g.position.set(P0.x,0.15,P0.z); g.rotation.y=Math.atan2(pw('chest').x-P0.x,pw('chest').z-P0.z); scene.add(g); onG.push(g);
      add(rbox(0.7,0.5,0.28,0.05),mat(0x3b4250,{r:0.6}),g,0,0.26,0); if(ECGT){ const s=add(new THREE.PlaneGeometry(0.56,0.32),new THREE.MeshBasicMaterial({map:ECGT,toneMapped:false}),g,0,0.3,0.145,false); s.userData.ecg=1; }
      add(rbox(0.7,0.08,0.28,0.03),mat(0xe85d04),g,0,0.02,0); },
    cuff(){ if(has('cuff')) return; onPat(cyl(0.17,0.17,0.26,14),mat(0x1f3b73),'armL',0,0.1,0,0.8,0,0,'cuff'); onPat(new THREE.BoxGeometry(0.1,0.08,0.12),mat(0xd62828),'wristL',0,0.05,0.12,0,0,0,'clip'); },
    pads(){ if(has('pad')) return; [[-0.2,-0.42],[0.25,0.05]].forEach(([x,z])=>onPat(rbox(0.26,0.03,0.34,0.02),mat(0xf6f6f6),'chest',x,0.01,z,0,0,0,'pad'));
      const g=new THREE.Group(); g.userData.sim='aedbox'; const P0=off('chest',-1.0,0.4); g.position.set(P0.x,0.15,P0.z); g.rotation.y=patient.rotation.y; scene.add(g); onG.push(g);
      add(rbox(0.55,0.18,0.45,0.05),mat(0x2e9e4f),g,0,0.09,0); add(new THREE.CircleGeometry(0.07,16),new THREE.MeshBasicMaterial({color:0xffd166}),g,0,0.185,0,false).rotation.x=-Math.PI/2; },
    electrodes(){ if(has('elec')) return; for(let i=0;i<6;i++) onPat(cyl(0.05,0.05,0.02,10),mat(0xffffff),'chest',-0.15+i*0.07,0.02,-0.05+Math.abs(i-2.5)*0.04,0,0,0,'elec'); [[-0.35,-0.5],[0.35,-0.5],[-0.3,0.7],[0.3,0.7]].forEach(([x,z])=>onPat(cyl(0.05,0.05,0.02,10),mat([0xd62828,0xffd166,0x2e9e4f,0x222222][onP.length%4]),'chest',x,-0.02,z,0,0,0,'elec')); G.monitor(); },
    ivbag(){ if(has('iv')) return; const g=new THREE.Group(); g.userData.sim='iv'; const P0=off('armL',0.55,0); g.position.set(P0.x,0,P0.z); scene.add(g); onG.push(g);
      add(cyl(0.025,0.025,1.9,8),mat(0xb8bec6,{m:0.7}),g,0,0.95,0); add(rbox(0.26,0.38,0.08,0.04),mat(0xcfe8ff,{op:0.7}),g,0,1.7,0.06);
      const W=pw('wristL'), top=V(P0.x,1.5,P0.z); const geo=new THREE.BufferGeometry().setFromPoints([top,V((top.x+W.x)/2,0.9,(top.z+W.z)/2),W]); const l=new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xddeeff})); l.userData.sim='ivl'; scene.add(l); onG.push(l);
      onPat(rbox(0.12,0.04,0.16,0.02),mat(0xf2f2f2),'wristL',0,0.06,0,0,0,0,'ivsite'); },
    tourniquet(k){ onPat(cyl(0.2,0.2,0.12,14),mat(0x15171a),k,0,0,-0.12,Math.PI/2,0,0,'tq'); onPat(new THREE.BoxGeometry(0.08,0.06,0.16),mat(0xd62828),k,0,0.2,-0.12,0,0,0,'tq'); },
    gauze(k){ onPat(rbox(0.3,0.08,0.3,0.03),mat(0xf6f6f6),k,0,0.12,0,0,0,0,'gz'); },
    splint(sager){ const k='shinR'; onPat(new THREE.BoxGeometry(0.06,0.12,0.9),mat(sager?0xb8bec6:0xff8c1a,{m:sager?0.6:0}),k,0.17,0,-0.05,0,0,0,'spl'); onPat(new THREE.BoxGeometry(0.06,0.12,0.9),mat(sager?0xb8bec6:0xff8c1a),k,-0.17,0,-0.05,0,0,0,'spl');
      [-0.3,0.1].forEach(z=>onPat(cyl(0.2,0.2,0.06,12),mat(0x1f3b73),k,0,0,z,Math.PI/2,0,0,'spl')); },
    tpod(){ onPat(cyl(0.56,0.56,0.28,20,1,true),mat(0x15171a),'pelvis',0,-0.45,0,Math.PI/2,0,0,'tpod'); },
    collar(){ if(has('collar')) return; onPat(cyl(0.3,0.3,0.2,16),mat(0xf28c28),'neck',0,-0.25,0,Math.PI/2,0,0,'collar'); },
    foil(){ if(has('foil')) return; onPat(rbox(1.15,0.36,2.0,0.15),mat(0xd7dde4,{m:0.9,r:0.2}),'belly',0,-0.38,0,0,0,0,'foil'); },
    marks(k){ if(has('marks')) return; const y=MK_Y[k]??0.13, ox=k==='thighL'?-0.05:0, oz=k==='thighL'?-0.18:0.08;
      onPat(new THREE.CircleGeometry(0.13,18),mat(0x6d4a7a,{op:0.55}),k,ox,y,oz,-Math.PI/2,0,0,'marks');
      [[-0.06,-0.07],[0.02,-0.03],[0.07,0.05],[-0.04,0.04],[0.01,0.1],[0.08,-0.08],[-0.08,0.09]].forEach(([x,z])=>onPat(sph(0.026),mat(0x5a0f12),k,ox+x,y+0.006,oz+z,0,0,0,'marks')); },
    burn(){ onPat(rbox(0.3,0.06,0.5,0.03),mat(0xe8f7ff),'armR',0,0.12,0.1,0,0,0,'bd'); },
    accm(){ if(has('accm')) return; const o=onPat(rbox(0.7,0.35,0.35,0.06),mat(0x3a3f47),'chest',0,0.32,0,0,0,0,'accm'); onPat(new THREE.BoxGeometry(0.06,0.6,0.32),mat(0x3a3f47),'chest',0.38,0,0,0,0,0,'accm'); onPat(new THREE.BoxGeometry(0.06,0.6,0.32),mat(0x3a3f47),'chest',-0.38,0,0,0,0,0,'accm'); }
  };
  /* ----- 病人眼皮、眉頭、反應（LOC 互動用） ----- */
  let FACE=null; const eye={open:true,force:null,ft:0,frown:0,flinch:0};
  function face(){ if(FACE) return FACE; const p=P(); const eyes=p.children.filter(m=>m.geometry&&m.geometry.parameters&&m.geometry.parameters.radius===0.08&&Math.abs(m.position.y-2.15)<0.01);
    const skin=M(C_SKIN()), dk=M(0x2a1d14); const lids=[], lines=[], brows=[];
    eyes.forEach(e=>{ lids.push(add(sph(0.1),skin,p,e.position.x,e.position.y,e.position.z+0.02,false)); const l=add(new THREE.BoxGeometry(0.17,0.025,0.03),dk,p,e.position.x,e.position.y-0.01,e.position.z+0.11,false); lines.push(l);
      const b=add(new THREE.BoxGeometry(0.2,0.045,0.04),dk,p,e.position.x,e.position.y+0.17,e.position.z+0.03,false); b.rotation.z=e.position.x>0?-0.35:0.35; brows.push(b); });
    FACE={lids,lines,brows}; setEyes(true); return FACE; }
  const C_SKIN=()=>(typeof C!=='undefined'&&C.skin)||0xffd7b5;
  function setEyes(open){ const F=FACE; if(!F) return; F.lids.forEach(o=>o.visible=!open); F.lines.forEach(o=>o.visible=!open); }
  function faceTick(dt,avpu){ if(!FACE) return; let open=Math.round(avpu)===0; if(eye.force!=null){ eye.ft-=dt; open=eye.force; if(eye.ft<=0) eye.force=null; }
    if(open&&((performance.now()/1000)%4.2)<0.12) open=false;   // 眨眼
    setEyes(open); eye.frown=Math.max(0,eye.frown-dt); FACE.brows.forEach(b=>b.visible=eye.frown>0);
    if(eye.flinch>0){ eye.flinch-=dt; const k=Math.sin(Math.min(1,eye.flinch)*Math.PI); P().userData.arms.forEach((a,i)=>a.rotation.x=-0.8-k*0.9); P().rotation.z=Math.sin(eye.flinch*20)*0.03; } }
  function react(kind,avpu){ face(); const a=Math.round(avpu);   // 回傳反應文字
    if(kind==='observe'){ act='observe'; at=0; return a===0?'open':'closed'; }
    if(kind==='voice'){ act='shout'; at=0; bubble(crewHead(C().c1),honor()+'！聽唔聽到我講嘢？',2.4);
      if(a===0){ setTimeout(()=>bubble(patHead,'聽到……',2.2,'#ffd98a'),900); return 'A'; }
      if(a===1){ setTimeout(()=>{ eye.force=true; eye.ft=3.5; bubble(patHead,'嗯……乜嘢事……',2.4,'#ffd98a'); },900); return 'V'; }
      return 'none'; }
    if(kind==='pain'){ act='squeeze'; at=0; bubble(crewHead(C().c1),'（擠壓斜方肌）',2.2);
      if(a<=1){ setTimeout(()=>{ eye.force=true; eye.ft=3; eye.frown=2; eye.flinch=1.2; bubble(patHead,'哎！好痛！做咩呀？',2.4,'#ffd98a'); },900); return 'over'; }
      if(a===2){ setTimeout(()=>{ eye.force=true; eye.ft=1.2; eye.frown=2.2; eye.flinch=1.4; bubble(patHead,'呃……（皺眉、縮手）',2.4,'#ffd98a'); },1000); return 'P'; }
      return 'none'; }
  }
  /* ----- 由步驟估動畫類型 ----- */
  function kindOf(c,Q){ const ans=Q&&Q.o?Q.o[Q.a]:'', T=(c.act||'')+' '+(c.find||'')+' '+ans, k=c.k;
    if(k==='CPR') return 'cpr'; if(k==='AED') return /唔需要電擊|不需要電擊|唔需電擊/.test(c.find)?'aedno':/電擊/.test(T)?'aed':'aedno';
    if(k==='AW'){ const A=c.act||''; return /^唔可以/.test(ans)?'no':/ACCM/.test(T)?'accm':/Combitube/.test(A)?'aw:combi':/LTS|LT-D/.test(A)?'aw:lt':/LMA/.test(A)?'aw:lma':'bvm'; } if(k==='RSE') return 'look'; if(k==='LOC') return 'tap'; if(k==='D') return /頭鎖/.test(ans)?'headlock':'askd';
    if(k==='CAB') return /CPR/.test(ans)&&/冇脈搏|摸唔到脈搏/.test(c.find)?'pulse':/BVM/.test(ans)?'bvm':'pulse';
    if(k==='O2') return /BVM|膠囊/.test(ans)?'o2:bvm':/不能回吸|NRM/.test(ans)?'o2:nrm':/文氏/.test(ans)?'o2:ven':/鼻插喉|簡單面罩/.test(ans)?'o2:nc':'o2:none';
    if(k==='RBS') return 'sweep'; if(k==='SKIN') return 'skin'; if(k==='VS') return 'vitals'; if(k==='HS') return 'gluco'; if(k==='HX') return 'talk'; if(k==='DEC') return 'dec';
    if(k==='CALL'||k==='HOSP') return 'radio'; if(k==='LG') return 'ready'; if(k==='RE'||k==='MIST') return 'handover';
    if(k==='BLEED') return /止血帶|HAT|第一條|第二條/.test((c.act||'')+' '+ans)&&!/止血敷料/.test(c.act||'')&&!/^唔可以|改用止血敷料|止血敷料按壓|按入傷口/.test(ans)?'tq':'press';
    if(k==='SPL') return /^無需|^檢查有冇危及/.test(ans)?'nexus':/T-POD|上板|大轉子/.test(T)?'tpod':/Sager|牽引|磅/.test(T)?'sager':/脊柱制動|頸套/.test(ans)?'collar':'splint';
    if(/^唔可以|^唔使|^未可以|^唔需要|^暫時唔可以/.test(ans)) return 'no';
    if(/Penthrox|綠哨子/.test(T)&&!/唔可以/.test(ans)) return 'whistle';
    if(/Hot Pack|保溫|毛氈/.test(T)) return 'foil';
    if(/NTG|脷底/.test(ans)) return 'spray'; if(/puff|Salbutamol|Ventolin|Atrovent|儲霧/.test(ans)) return 'mdi';
    if(/ACCM|30:2、深度/.test(T)) return 'accm';
    if(/口服|ASA|阿士匹靈|活性炭|200 mg，只俾一劑|50 g/.test(ans)) return 'pill';
    if(/Adrenaline|Amiodarone|Thiamine|3-way|IV|IO\b/.test(ans)&&!/肌肉注射|Jext|EpiPen/.test(ans)) return 'iv';
    if(/肌肉注射|IM\b|Jext|EpiPen|Midazolam|Naloxone|Glucagon|Piriton|Tramadol|Olanzapine|股外肌/.test(ans)) return 'jab';
    if(/\d+ mg（\d/.test(ans)) return 'iv';
    if(/D10W|NS |NS$|IV|IO|Full Rate|ml／hr|500 ml|100 mg／1 ml|Adrenaline|Amiodarone|Thiamine|一次注射/.test(ans)) return 'iv';
    if(/ECG|心電圖|電極|肋間/.test(T)) return 'ecg';
    if(/FiO|氧氣|SpO₂/.test(ans)) return 'o2:mask';
    if(/保溫|毛氈|Hot Pack|Hypothermia|包裹/.test(ans)) return 'foil'; if(/腋下|回暖/.test(ans)) return 'warm';
    if(/沖洗|燒傷敷料|沖約/.test(ans)) return 'burn'; if(/夾板|固定骨折/.test(ans)) return 'splint';
    return 'kit'; }
  const LINES={look:'現場安全，可以埋位！',tap:'先生！聽唔聽到我講嘢？',headlock:'唔好郁，我幫你固定頭部',askd:'有冇跌親？條頸痛唔痛？',pulse:'檢查脈搏同呼吸',bvm:'幫佢灌氣！',sweep:'快速檢查全身',skin:'睇吓皮膚……',dec:'',nexus:'逐項評估 NEXUS',mdi:'用儲霧器，慢慢吸',warm:'用體溫慢慢回暖，唔好搓','aw:lt':'插 LT 喉，接 BVM','aw:lma':'插 LMA，接 BVM','aw:combi':'插 Combitube，試 #1 藍管',vitals:'量血壓、血氧',gluco:'篤一篤手指驗血糖',talk:'可唔可以講吓發生咩事？',radio:'控制，A188 通報……',ready:'準備上車床！',handover:'醫生，交接病人',no:'呢個情況唔可以用',whistle:'含住綠哨子慢慢吸',spray:'張開口，脷底噴一下',pill:'嚟，食咗佢',jab:'打針喇，忍一忍',iv:'吊鹽水／打藥',ecg:'貼電極做心電圖',kit:'準備器材',cpr:'一、二、三、四……',aed:'所有人離開病人！',aedno:'AED 分析中，唔好掂病人',tq:'止血帶收緊！',press:'用力壓住傷口',splint:'固定好隻腳',sager:'牽引夾板拉緊',tpod:'T-POD 收緊',collar:'戴頸套',foil:'包好保暖',burn:'沖水、蓋燒傷敷料',accm:'ACCM 開機'};
  const FOC={mdi:'head',nexus:'neck','aw:lt':'head','aw:lma':'head','aw:combi':'head',warm:'armR',tap:'head',headlock:'head',askd:'head',bvm:'head','o2:bvm':'head','o2:nrm':'head','o2:nc':'head','o2:ven':'head','o2:mask':'head',spray:'head',whistle:'head',pill:'head',talk:'head',gluco:'armL',vitals:'armL',iv:'armL',jab:'thighL',tq:'thighL',press:'neck',splint:'shinR',sager:'shinR',tpod:'pelvis',collar:'neck',sweep:'belly',cpr:'chest',aed:'chest',aedno:'chest',ecg:'chest',accm:'chest',burn:'armR',foil:'belly'};
  /* ----- 播放 ----- */
  function clearBubbles(){ fx.forEach(f=>scene.remove(f.o)); fx.length=0; }
  const SAFE=new Set(['dec','nexus','look','tap','headlock','askd','pulse','sweep','skin','vitals','gluco','talk','radio','ready','handover','cpr','aed','aedno','ecg']);
  // 問題出現：救護員就位、做評估動作（唔會預先揭曉答案）
  const ALIAS={'aw:lt':'bvm','aw:lma':'bvm','aw:combi':'bvm',mdi:'spray',warm:'press',dec:'talk',nexus:'askd'};
  const ansOf=Q=>Q&&Q.o?Q.o[Q.a]:'';
  function lineQ(k,c){ const out=avpuNow>=2;
    if(k==='tap') return honor()+'！聽唔聽到我講嘢？';
    if(k==='talk') return out?'旁邊有冇人知發生咩事？':'可唔可以講吓發生咩事？';
    if(k==='askd') return out?'佢有冇跌親、撞親頭？':LINES.askd;
    if(k==='dec') return '穩定定唔穩定？';
    if(k==='skin'){ const f=(c.find||'').replace(/[。．]$/,''), a=f.split(/[；、，]/)[0]; if(/針孔/.test(f)){ const w=/大腿/.test(f)?'大腿':'手臂'; setTimeout(()=>bubble(crewHead(C().c1),w+'有好多針孔！',2.6),1500); } return a?'皮膚：'+a.slice(0,10):LINES.skin; }
    if(SAFE.has(k)) return LINES[k];
    return (c.act||'').replace(/：.*$/,'').slice(0,14); }
  function lineA(k,c,Q){ const a=ansOf(Q), out=avpuNow>=2;
    if(k==='o2:none') return 'SpO₂ 正常，暫時唔使氧'; if(k==='o2:bvm') return 'BVM 輔助通氣，接 15 L 氧'; if(k==='o2:nc') return out?'戴鼻插喉':'幫你戴鼻插喉'; if(k.startsWith('o2')) return out?'戴氧氣罩':'幫你戴氧氣罩';
    if(k==='no') return a.split('，')[0].slice(0,22)||LINES.no;
    if(k==='kit') return '';
    if(k==='jab'){ const d=(a.match(/Naloxone|Glucagon|Midazolam|Jext|EpiPen|Piriton|Chlorpheniramine|Tramadol|Olanzapine/)||[])[0]; return out?'肌肉注射'+(d?' '+d:''):(d?d+'，':'')+'打針喇，忍一忍'; }
    if(k==='iv'){ const d=(a.match(/Adrenaline|Amiodarone|Thiamine|D10W|TXA|NS/)||[])[0]; if(!d) return /IO/.test(a)?'鑽 IO 建立通道':'建立 IV 通道'; return d==='NS'?'吊 NS 鹽水':d==='D10W'?'吊 D10W':'IV 推 '+d+'，沖管'; }
    if(k==='pill'&&out) return '準備口服藥';
    return LINES[k]; }
  function quoteBubble(c){ const f=c.find||''; const re=/「([^」]{2,24})」/g; let m, n=0;
    while((m=re.exec(f))){ const ctx=f.slice(Math.max(0,m.index-10),m.index); if(!/話|講|答|喊|嗌|問|：/.test(ctx)) continue;
      const sp=(ctx.match(/(兒子|女兒|家人|旁人|太太|丈夫|老婆|老公|媽媽|爸爸|朋友|同事|職員|途人)/)||[])[1]; const txt=m[1], d=700+n*1600; n++;
      if(sp&&bystander&&bystander.visible) setTimeout(()=>bubble(()=>bystander.position.clone().add(V(0,2.7,0)),sp+'：'+txt,3,'#bde0ff'),d);
      else if(!sp) setTimeout(()=>bubble(patHead,txt,2.8,'#ffd98a'),d); } }
  function play(c,Q,hosp){ const k=kindOf(c,Q); at=0; focus=FOC[k]||(k==='skin'&&MARKS?MARKS:'chest'); if(!manual) camA=bestAngle(camA); clearBubbles();
    const {c1,c2}=C(); const who=['tap','headlock','askd','bvm','talk','spray','whistle','pill','radio'].includes(k)||k.startsWith('o2')?c1:c2;
    if(hosp){ bubble(crewHead(c1),c.k==='MIST'?'醫生，交接病人：MIST':'重新評估病人',3); act=null; return; }
    posCrew(); const safe=SAFE.has(k); act=safe?(ALIAS[k]||k):(k==='no'?'talk':'kit');
    bubble(crewHead(who),lineQ(k,c),3); quoteBubble(c);
    if(k==='vitals'){ G.cuff(); G.monitor(); } if(k==='aed'||k==='aedno') G.pads(); if(k==='ecg') G.electrodes(); if(k==='gluco') G.monitor();
    pend={c,Q,k}; }
  // 答完：做處理（道具、藥物、電擊……）
  let pend=null;
  function apply(){ if(!pend) return; const {c,Q,k}=pend; pend=null; const {c1,c2}=C(); act=ALIAS[k]||k; at=0;
    if(!SAFE.has(k)){ const line=lineA(k,c,Q); if(line) clearBubbles(); bubble(crewHead(['bvm','spray','mdi','whistle','pill','aw:lt','aw:lma','aw:combi'].includes(k)||k.startsWith('o2')?c1:c2),line,2.8); }
    if(k==='cpr') cpr=true; if(k==='o2:bvm'||k==='bvm'||k.startsWith('aw:')){ G.bvm(); ventOn=true; }
    if(k.startsWith('o2:')&&k!=='o2:bvm') G.mask(k.slice(3)==='mask'?'mask':k.slice(3));
    if(k==='aed') shockAt=0.6; if(k==='iv') G.ivbag();
    if(k==='tq'){ const T=(c.find||'')+(c.act||''); G.tourniquet(/小腿/.test(T)?'shinL':'thighL'); } if(k==='press'){ const T=c.find||''; G.gauze(/頸/.test(T)?'neck':/腹股溝/.test(T)?'pelvis':/胸/.test(T)?'chest':'thighL'); }
    if(k==='splint') G.splint(false); if(k==='sager') G.splint(true); if(k==='tpod') G.tpod(); if(k==='collar') G.collar();
    if(k==='foil') G.foil(); if(k==='burn') G.burn(); if(k==='accm'){ G.accm(); cpr=true; }
    if(c.set&&c.set.rhythm&&c.set.rhythm!=='vf'&&c.set.rhythm!=='asys') cpr=false; }
  /* ----- 每格 ----- */
  let avpuNow=0;
  function tick(dt,t,rr,rhythm,hosp,avpu){ const {c1,c2}=C(); at+=dt; avpuNow=avpu??0;
    if(hosp){ for(let i=fx.length-1;i>=0;i--){ const f=fx[i]; f.t+=dt; f.f(f.o,f.t/f.d); if(f.t>=f.d){ scene.remove(f.o); fx.splice(i,1); } } return; }
    const A1=c1.userData.arms, A2=c2.userData.arms; const set=(A,a,b)=>{ A[0].rotation.x=a; A[1].rotation.x=b; };
    // 病人：呼吸／抽搐／CPR 按壓
    const tor=torso(), p=P(); p.rotation.z=0; p.position.set(0,0.5,1.2);
    if(rhythm==='noise'){ p.rotation.z=Math.sin(t*38)*0.05; p.position.y=0.5+Math.abs(Math.sin(t*31))*0.05; p.userData.arms.forEach((a,i)=>a.rotation.x=-0.8+Math.sin(t*40+i)*0.5); } else if(!(eye.flinch>0)) p.userData.arms.forEach(a=>a.rotation.x=-0.8);
    const breath=rr>0&&!cpr?Math.max(0,Math.sin(t*(rr/60)*Math.PI*2))*0.06:0;
    let comp=0; if(cpr){ const ph=(t*1.85)%1; comp=ph<0.45?Math.sin(ph/0.45*Math.PI)*0.14:0; }
    tor.scale.set(1+breath*0.5,1,1+breath-comp);
    if(jolt>0){ jolt-=dt; p.position.y=0.5+Math.max(0,jolt)*0.6; }
    faceTick(dt,avpuNow);
    // 救護員
    c1.position.y=-0.38; c2.position.y=-0.38;
    if(cpr){ c2.position.y=-0.38-comp*0.6; set(A2,-1.25-comp,-1.25-comp); place(c2,off('chest',0.95,-0.05),pw('chest')); c2.position.y=-0.32-comp*0.9; }
    if(ventOn||act==='bvm'){ const bv=onP.find(o=>o.userData.sim==='bvm'); const sq=(t%(cpr?3.2:6))<0.7; if(bv) bv.scale.set(sq?0.75:1,sq?0.75:1,1.6*(sq?0.85:1)); set(A1,-1.3,-1.3+(sq?0.25:0)); }
    const k=act, w=Math.sin(at*6);
    if(k==='look'){ c1.rotation.y+=Math.sin(at*1.6)*0.01; c2.rotation.y-=Math.sin(at*1.6)*0.01; c1.position.y=0; c2.position.y=0; set(A1,-0.4,-0.4); }
    else if(k==='tap'){ set(A1,-1.1+w*0.25,-0.8); }
    else if(k==='observe'){ set(A1,-0.6,-0.6); c1.position.y=-0.38+Math.sin(at*1.5)*0.04; }
    else if(k==='shout'){ set(A1,-1.0+Math.sin(at*7)*0.3,-1.0-Math.sin(at*7)*0.3); c1.position.y=-0.32; }
    else if(k==='squeeze'){ const sq=Math.min(1,at/0.6); set(A1,-1.5-sq*0.25,-1.5-sq*0.25); c1.position.y=-0.3-Math.sin(at*10)*0.02*(at<2?1:0); }
    else if(k==='headlock'||k==='askd'){ set(A1,-1.25,-1.25); }
    else if(k==='pulse'){ set(A2,-1.2,-0.9); c1.rotation.x=0; set(A1,-1.0,-1.0); }
    else if(k==='sweep'){ const u=(at%2.4)/2.4; place(c2,off('chest',1.25,-0.9+u*1.9),pw('chest')); set(A2,-1.2,-1.2+Math.sin(at*8)*0.1); }
    else if(k==='skin'||k==='gluco'||k==='vitals'||k==='iv'||k==='ecg'||k==='kit'||k==='burn'||k==='press'||k==='tq'||k==='splint'||k==='sager'||k==='tpod'||k==='collar'||k==='foil'){ set(A2,-1.15+w*0.12,-1.0-w*0.12); if(!ventOn&&!cpr) set(A1,-0.9,-0.9); }
    else if(k==='jab'){ const ph=Math.min(1,at/1.2); set(A2,-1.6+ph*0.6,-0.8); }
    else if(k==='spray'||k==='pill'||k==='whistle'){ set(A1,-1.3+Math.sin(at*3)*0.1,-0.7); }
    else if(k==='talk'||k==='no'){ set(A2,-0.7+Math.sin(at*4)*0.15,-0.6); }
    else if(k==='radio'){ c1.position.y=0; set(A1,-2.7,-0.6); }
    else if(k==='aed'||k==='aedno'){ if(!cpr) set(A2,-1.0,-1.0); if(k==='aed'&&shockAt>0){ shockAt-=dt; set(A2,-0.3,-0.3); c2.position.y=0; if(shockAt<=0){ shockAt=-1; jolt=0.25; flash(); } } }
    tfxTick(dt);
    // 道具：監測器螢幕
    if(ECGT) ECGT.needsUpdate=true;
    // 對白氣泡
    for(let i=fx.length-1;i>=0;i--){ const f=fx[i]; f.t+=dt; f.f(f.o,f.t/f.d); if(f.t>=f.d){ scene.remove(f.o); f.o.material.map.dispose(); f.o.material.dispose(); fx.splice(i,1); } } }
  // 電擊閃光
  const FL=document.createElement('div'); FL.style.cssText='position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:29;transition:opacity .35s'; document.body.append(FL);
  const PL=new THREE.PointLight(0xbfe4ff,0,12,2); scene.add(PL);
  function flash(){ FL.style.transition='none'; FL.style.opacity='0.85'; requestAnimationFrame(()=>{ FL.style.transition='opacity .45s'; FL.style.opacity='0'; }); PL.position.copy(pw('chest')).add(V(0,1,0)); PL.intensity=6; setTimeout(()=>PL.intensity=0,160); vib([60,30,60]); try{ if(actx){ const o=actx.createOscillator(), g=actx.createGain(); o.type='sawtooth'; o.frequency.setValueAtTime(90,actx.currentTime); g.gain.setValueAtTime(0.08,actx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001,actx.currentTime+0.3); o.connect(g); g.connect(master||actx.destination); o.start(); o.stop(actx.currentTime+0.3); } }catch(e){} }
  /* ----- 電影鏡頭：圍住動作位置慢慢轉 ----- */
  let zoom=1, manual=false, inpOn=false, panX=0, panZ=0, panning=false, lastA=0, pm=null; const pts=new Map(); let pd=0;
  function doPan(dx,dy){ const s=0.012*zoom, ca=Math.cos(lastA), sa=Math.sin(lastA); panX+=-ca*dx*s+(-sa)*dy*s; panZ+=sa*dx*s+(-ca)*dy*s; const L=Math.hypot(panX,panZ); if(L>3.5){ panX*=3.5/L; panZ*=3.5/L; } manual=true; }
  function resetView(){ zoom=1; panX=panZ=0; manual=false; try{ camA=bestAngle(); }catch(e){} if(S.camDrag){ S.camDrag.yaw=0; S.camDrag.pitch=0; } }
  const inScene=()=>document.body.classList.contains('simScene');
  function initInput(){ if(inpOn||typeof R==='undefined') return; inpOn=true; const dom=R.domElement;
    dom.addEventListener('wheel',e=>{ if(!inScene()) return; e.preventDefault(); zoom=Math.max(0.6,Math.min(1.45,zoom*(e.deltaY>0?1.07:1/1.07))); manual=true; },{passive:false});
    dom.addEventListener('contextmenu',e=>{ if(inScene()) e.preventDefault(); });
    dom.addEventListener('pointerdown',e=>{ pts.set(e.pointerId,{x:e.clientX,y:e.clientY}); if(!inScene()) return; manual=true; if(e.button===1||e.button===2||e.shiftKey){ panning=true; pm={x:e.clientX,y:e.clientY}; if(S.camDrag) S.camDrag.on=false; } if(pts.size===2){ const [p1,p2]=[...pts.values()]; pd=Math.hypot(p1.x-p2.x,p1.y-p2.y); pm={x:(p1.x+p2.x)/2,y:(p1.y+p2.y)/2}; if(S.camDrag) S.camDrag.on=false; } });
    dom.addEventListener('pointermove',e=>{ if(!pts.has(e.pointerId)) return; pts.set(e.pointerId,{x:e.clientX,y:e.clientY}); if(panning&&pts.size===1&&inScene()&&pm){ doPan(e.clientX-pm.x,e.clientY-pm.y); pm={x:e.clientX,y:e.clientY}; } if(pts.size===2&&inScene()){ if(S.camDrag) S.camDrag.on=false; const [p1,p2]=[...pts.values()], d=Math.hypot(p1.x-p2.x,p1.y-p2.y), mx=(p1.x+p2.x)/2, my=(p1.y+p2.y)/2; if(pm){ doPan(mx-pm.x,my-pm.y); } pm={x:mx,y:my}; if(pd>10&&d>10) zoom=Math.max(0.6,Math.min(1.45,zoom*pd/d)); pd=d; } });
    ['pointerup','pointercancel','pointerleave'].forEach(ev=>dom.addEventListener(ev,e=>{ pts.delete(e.pointerId); if(!pts.size){ panning=false; pm=null; } else if(pts.size===1) pm=null; }));
    addEventListener('keydown',e=>{ if(!inScene()) return; const m={ArrowLeft:[-30,0],ArrowRight:[30,0],ArrowUp:[0,-30],ArrowDown:[0,30]}[e.key]; if(m&&e.shiftKey){ doPan(m[0],m[1]); e.preventDefault(); } }); }
  // 揀一個冇樓宇、冇救護車擋住、避開救護員嘅鏡頭方向
  function clearAt(a,r){ const F=pw('chest'); for(let k=0.15;k<=1.0001;k+=0.05){ const x=F.x+Math.sin(a)*r*k, z=F.z+Math.cos(a)*r*k; if(typeof cellAt==='function'&&(cellAt(x,z)&2)) return false; if(typeof amb!=='undefined'&&amb.visible&&Math.hypot(x-amb.position.x,z-amb.position.z)<3.2) return false; if(k>0.3&&typeof bystander!=='undefined'&&bystander.visible&&Math.hypot(x-bystander.position.x,z-bystander.position.z)<1.4) return false; } return true; }
  function bestAngle(prefer){ const pa=patient.rotation.y, base=pa-Math.PI/2; const C=[0,0.35,-0.35,0.7,-0.7,1.05,-1.05,1.4,-1.4,1.8,-1.8,2.3,-2.3,Math.PI].map(d=>base+d);
    if(prefer!=null){ const near=C.slice().sort((x,y)=>Math.abs(Math.atan2(Math.sin(x-prefer),Math.cos(x-prefer)))-Math.abs(Math.atan2(Math.sin(y-prefer),Math.cos(y-prefer)))); if(clearAt(prefer,7)) return prefer; for(const a of near) if(clearAt(a,7)) return a; }
    for(const a of C) if(clearAt(a,7)) return a; return base; }
  function cam(t){ const D=S.camDrag||{yaw:0,pitch:0}; const F=pw(focus).add(V(panX,0,panZ)), a=camA+(manual?0:Math.sin(t*0.12)*0.18)+D.yaw; lastA=a; const pz=Math.max(0.45,Math.min(1.6,1+D.pitch*0.7)), r=(focus==='head'?5.6:6.8)*zoom/Math.sqrt(pz), h=(focus==='head'?8.2:7.8)*zoom*pz; return {p:V(F.x+Math.sin(a)*r,h,F.z+Math.cos(a)*r),l:V(F.x+Math.sin(a)*1.4,0.2,F.z+Math.cos(a)*1.4)}; }
  // 現場道具（按個案）
  function sceneProps(list){ const spots=[[-1.5,-0.6],[-1.6,0.5],[-1.2,1.3],[1.6,1.4],[-1.9,-1.3],[1.7,-1.5]]; let i=0;
    const nx=()=>spots[(i++)%spots.length];
    const grp=(name,build,k='chest',y=0.16)=>{ const [sd,fw]=nx(); const g=new THREE.Group(); build(g); const P=pw(k), a=patient.rotation.y; g.position.set(P.x+Math.cos(a)*sd+Math.sin(a)*fw,y,P.z-Math.sin(a)*sd+Math.cos(a)*fw); g.rotation.y=a+Math.random()*2; g.userData.sim='prop'; scene.add(g); onG.push(g); return g; };
    const B={
      syringe:g=>{ const b=add(cyl(0.035,0.035,0.3,10),mat(0xeef6ff,{op:0.8}),g,0,0.04,0); b.rotation.z=Math.PI/2; const n=add(cyl(0.006,0.006,0.12,6),mat(0xb8bec6,{m:0.8}),g,0.21,0.04,0); n.rotation.z=Math.PI/2; const p=add(cyl(0.02,0.02,0.08,8),mat(0xff8c1a),g,-0.18,0.04,0); p.rotation.z=Math.PI/2; },
      bottle:g=>{ add(cyl(0.07,0.07,0.22,14),mat(0x8a4b12,{op:0.85}),g,0,0.11,0); add(cyl(0.045,0.045,0.05,12),mat(0xf2f2f2),g,0,0.245,0); },
      pillbox:g=>{ add(new THREE.BoxGeometry(0.22,0.05,0.12),mat(0xffffff),g,0,0.03,0); add(new THREE.BoxGeometry(0.22,0.02,0.12),mat(0x4f8ef7),g,0,0.065,0); },
      inhaler:g=>{ add(new THREE.BoxGeometry(0.06,0.14,0.05),mat(0x2f6fe8),g,0,0.07,0); add(new THREE.BoxGeometry(0.06,0.05,0.08),mat(0x2f6fe8),g,0,0.02,0.05); },
      insulin:g=>{ const p=add(cyl(0.025,0.025,0.2,10),mat(0xff8c1a),g,0,0.03,0); p.rotation.z=Math.PI/2; },
      glucometer:g=>{ add(new THREE.BoxGeometry(0.1,0.03,0.16),mat(0x2a2f38),g,0,0.02,0); add(new THREE.BoxGeometry(0.07,0.005,0.06),mat(0x9fe8ff,{e:0x113344}),g,0,0.037,-0.03); },
      plate:g=>{ add(cyl(0.2,0.17,0.03,20),mat(0xffffff),g,0,0.02,0); [[0.05,0.03],[-0.06,-0.02],[0.01,-0.07]].forEach(([x,z])=>{ const t=add(new THREE.TorusGeometry(0.035,0.015,6,10,Math.PI*1.4),mat(0xff7f50),g,x,0.05,z); t.rotation.x=Math.PI/2; }); },
      helmet:g=>{ add(new THREE.SphereGeometry(0.2,16,10,0,Math.PI*2,0,Math.PI/2),mat(0x15171a,{r:0.3}),g,0,0,0); add(new THREE.BoxGeometry(0.22,0.06,0.02),mat(0x335577,{op:0.6}),g,0,0.1,0.19); },
      bucket:g=>{ add(cyl(0.17,0.14,0.28,16),mat(0x9fb0c3),g,0,0.14,0); },
      stove:g=>{ add(cyl(0.2,0.16,0.18,16),mat(0x3a2a22),g,0,0.09,0); [0,1,2,3,4].forEach(j=>add(sph(0.04),mat(0x331111,{e:0xff3300}),g,Math.cos(j)*0.08,0.19,Math.sin(j)*0.08)); },
      kettle:g=>{ add(sph(0.14),mat(0xc0c6ce,{m:0.7}),g,0,0.13,0); const sp=add(cyl(0.02,0.03,0.14,8),mat(0xc0c6ce,{m:0.7}),g,0.15,0.16,0); sp.rotation.z=-1; },
      glass:g=>{ for(let j=0;j<6;j++){ const t=add(new THREE.BoxGeometry(0.08+Math.random()*0.06,0.01,0.05),mat(0xcfefff,{op:0.5}),g,(Math.random()-0.5)*0.5,0.01,(Math.random()-0.5)*0.5); t.rotation.y=Math.random()*3; } },
      towel:g=>{ add(new THREE.BoxGeometry(0.5,0.05,0.35),mat(0x4f8ef7),g,0,0.025,0); },
      bag:g=>{ add(rbox(0.36,0.42,0.2,0.06),mat(0x2e7d4f),g,0,0.21,0); add(new THREE.BoxGeometry(0.3,0.04,0.02),mat(0x15171a),g,0,0.36,0.11); },
      chair:g=>{ add(new THREE.BoxGeometry(0.4,0.05,0.4),mat(0x8a5a3c),g,0,0.42,0); [[-0.17,-0.17],[0.17,-0.17],[-0.17,0.17],[0.17,0.17]].forEach(([x,z])=>add(new THREE.BoxGeometry(0.04,0.42,0.04),mat(0x6a442c),g,x,0.21,z)); add(new THREE.BoxGeometry(0.4,0.4,0.04),mat(0x8a5a3c),g,0,0.64,-0.18); },
      lvadbag:g=>{ add(rbox(0.26,0.16,0.12,0.03),mat(0x15171a),g,0,0.08,0); add(new THREE.BoxGeometry(0.1,0.01,0.06),mat(0x3ddc6a,{e:0x0a4020}),g,0,0.165,0); }
    };
    list.forEach(n=>{ if(n==='blood'){ const o=onGround(new THREE.CircleGeometry(0.55,24),mat(0x5a0a0a,{op:0.78,r:0.2}),CASE&&CASE.id==='hd'?'neck':'thighL',0.5,0,0.135,'prop'); o.rotation.x=-Math.PI/2; return; }
      if(B[n]) grp(n,B[n]); }); }
  function enter(){ initInput(); try{ const d=CASE&&typeof SIMNOTES!=='undefined'&&SIMNOTES.get(CASE); if(d&&d.props) sceneProps(d.props); }catch(e){} zoom=1; manual=false; if(S.camDrag){ S.camDrag.yaw=0; S.camDrag.pitch=0; } panX=panZ=0; posCrew(); camA=bestAngle(); face(); if(MARKS) G.marks(MARKS); }
  function leaveScene(){ occClear(); tfx.forEach(f=>scene.remove(f.o)); tfx.length=0; restore(); act=null; ventOn=false; cpr=false; onG.forEach(o=>{ scene.remove(o); }); onG.length=0; fx.forEach(f=>scene.remove(f.o)); fx.length=0; }
  function clear(){ if(FACE){ setEyes(true); FACE.brows.forEach(b=>b.visible=false); } eye.force=null; eye.frown=0; eye.flinch=0; leaveScene(); onP.forEach(o=>o.parent&&o.parent.remove(o)); onP.length=0; }
  function focusOn(k){ focus=k; }
  // 🧰 工具列：用工具 → 道具 + 動作 + 對白
  let CASE=null;
  const TOOLACT={spo2:'vitals',bp:'vitals',gluco:'gluco',torch:'tap',steth:'pulse',thermo:'vitals',ecg:'ecg',nc:'o2:nc',mask:'o2:mask',nrm:'o2:nrm',ven:'o2:ven',bvm:'bvm',opa:'bvm',npa:'bvm',suction:'kit',lt:'bvm',lma:'bvm',combi:'bvm',
    aed:'aedno',accm:'accm',io:'iv',asa:'pill',ntg:'spray',salb:'spray',ipra:'spray',d10:'pill',ns:'iv',ivset:'iv',thia:'iv',gluc:'jab',nalox:'jab',charc:'pill',mida:'jab',jext:'jab',piri:'jab',trama:'jab',txa:'iv',olz:'jab',penth:'whistle',adr:'iv',amio:'iv',
    tq:'tq',hd:'press',gauze:'press',splint:'splint',sager:'sager',tpod:'tpod',collar:'collar',board:'kit',burn:'burn',water:'burn',foil:'foil',wrap:'foil',hotpack:'foil',ppe:'kit',chair:'kit',phone:'radio'};
  // 工具動畫：細模型由救護員手飛去病人身體位置 → 做動作（推針、噴、聽、照）→ 留低道具
  const tfx=[];
  const MINI={
    syringe:()=>{ const g=new THREE.Group(); add(cyl(0.035,0.035,0.24,10),mat(0xeef6ff,{op:0.85}),g,0,0,0); add(cyl(0.006,0.006,0.1,6),mat(0xb8bec6,{m:0.8}),g,0,-0.17,0); const pl=add(cyl(0.02,0.02,0.1,8),mat(0xff8c1a),g,0,0.16,0); g.userData.pl=pl; return g; },
    clip:()=>{ const g=new THREE.Group(); add(new THREE.BoxGeometry(0.12,0.09,0.14),mat(0xd62828),g,0,0,0); return g; },
    cuff:()=>{ const g=new THREE.Group(); const c=add(cyl(0.16,0.16,0.24,14),mat(0x1f3b73),g,0,0,0); c.rotation.x=0.8; add(sph(0.07),mat(0x15171a),g,0.2,0.1,0); return g; },
    meter:()=>{ const g=new THREE.Group(); add(new THREE.BoxGeometry(0.1,0.03,0.16),mat(0x2a2f38),g,0,0,0); add(new THREE.BoxGeometry(0.07,0.01,0.06),mat(0x9fe8ff,{e:0x225566}),g,0,0.02,-0.03); return g; },
    torch:()=>{ const g=new THREE.Group(); const b=add(cyl(0.03,0.03,0.2,10),mat(0x2a2f38,{m:0.5}),g,0,0,0); b.rotation.x=Math.PI/2; const cone=add(new THREE.ConeGeometry(0.12,0.4,16,1,true),mat(0xfff6c0,{op:0.35,e:0xfff2a0}),g,0,0,0.3); cone.rotation.x=-Math.PI/2; g.userData.cone=cone; return g; },
    steth:()=>{ const g=new THREE.Group(); add(cyl(0.06,0.06,0.03,14),mat(0xb8bec6,{m:0.8}),g,0,0,0); add(new THREE.TorusGeometry(0.16,0.012,6,20,Math.PI),mat(0x15171a),g,0,0.18,0); return g; },
    thermo:()=>{ const g=new THREE.Group(); add(new THREE.BoxGeometry(0.05,0.16,0.04),mat(0xffffff),g,0,0,0); add(new THREE.BoxGeometry(0.04,0.04,0.01),mat(0x9fe8ff,{e:0x225566}),g,0,0.03,0.025); return g; },
    pads:()=>{ const g=new THREE.Group(); add(rbox(0.22,0.02,0.3,0.01),mat(0xf6f6f6),g,-0.14,0,0); add(rbox(0.22,0.02,0.3,0.01),mat(0xf6f6f6),g,0.14,0,0); return g; },
    mask:()=>{ const g=new THREE.Group(); add(sph(0.13),mat(0x9ee6b8,{op:0.7}),g,0,0,0); return g; },
    bvm:()=>{ const g=new THREE.Group(); const b=add(sph(0.2),mat(0x2f6fe8,{op:0.85}),g,0,0,0); b.scale.set(1,1,1.6); add(sph(0.11),mat(0x9ee6b8,{op:0.7}),g,0,0,-0.32); return g; },
    tube:()=>{ const g=new THREE.Group(); const t=add(new THREE.TorusGeometry(0.14,0.025,8,16,Math.PI),mat(0xf2f2f2,{op:0.9}),g,0,0,0); t.rotation.y=Math.PI/2; return g; },
    bag:()=>{ const g=new THREE.Group(); add(rbox(0.2,0.3,0.06,0.03),mat(0xcfe8ff,{op:0.75}),g,0,0,0); return g; },
    cup:()=>{ const g=new THREE.Group(); add(cyl(0.06,0.05,0.12,12),mat(0xffffff,{op:0.8}),g,0,0,0); return g; },
    pill:()=>{ const g=new THREE.Group(); add(sph(0.04),mat(0xffffff),g,0,0,0); return g; },
    inhaler:()=>{ const g=new THREE.Group(); add(new THREE.BoxGeometry(0.06,0.14,0.05),mat(0x2f6fe8),g,0,0,0); add(new THREE.BoxGeometry(0.06,0.05,0.08),mat(0x2f6fe8),g,0,-0.06,0.05); return g; },
    whistle:()=>{ const g=new THREE.Group(); const w=add(cyl(0.035,0.035,0.2,10),mat(0x3ddc6a),g,0,0,0); w.rotation.x=Math.PI/2; return g; },
    tq:()=>{ const g=new THREE.Group(); const t=add(new THREE.TorusGeometry(0.17,0.04,8,18),mat(0x15171a),g,0,0,0); t.rotation.x=Math.PI/2; add(new THREE.BoxGeometry(0.06,0.04,0.14),mat(0xd62828),g,0.18,0.03,0); return g; },
    gauze:()=>{ const g=new THREE.Group(); add(rbox(0.26,0.06,0.26,0.02),mat(0xf6f6f6),g,0,0,0); return g; },
    splint:()=>{ const g=new THREE.Group(); add(new THREE.BoxGeometry(0.06,0.1,0.7),mat(0xff8c1a),g,-0.15,0,0); add(new THREE.BoxGeometry(0.06,0.1,0.7),mat(0xff8c1a),g,0.15,0,0); return g; },
    collar:()=>{ const g=new THREE.Group(); const c=add(cyl(0.22,0.22,0.16,16,1,true),mat(0xf28c28),g,0,0,0); c.rotation.x=Math.PI/2; return g; },
    foil:()=>{ const g=new THREE.Group(); add(new THREE.BoxGeometry(0.6,0.02,0.5),mat(0xd7dde4,{m:0.9,r:0.2}),g,0,0,0); return g; },
    drill:()=>{ const g=new THREE.Group(); add(rbox(0.1,0.16,0.08,0.02),mat(0x2a7de1),g,0,0,0); add(cyl(0.01,0.01,0.12,6),mat(0xb8bec6,{m:0.8}),g,0,-0.13,0); return g; },
    box:()=>{ const g=new THREE.Group(); add(rbox(0.4,0.2,0.3,0.04),mat(0x3a3f47),g,0,0,0); return g; },
    phone:()=>{ const g=new THREE.Group(); add(rbox(0.07,0.14,0.02,0.01),mat(0x15171a),g,0,0,0); return g; },
    glove:()=>{ const g=new THREE.Group(); add(rbox(0.1,0.16,0.04,0.02),mat(0x6aa9ff),g,-0.07,0,0); add(rbox(0.1,0.16,0.04,0.02),mat(0x6aa9ff),g,0.07,0,0); return g; },
    board:()=>{ const g=new THREE.Group(); add(rbox(0.5,0.05,1.6,0.04),mat(0xffcf5a),g,0,0,0); return g; }
  };
  // [模型, 身體位置, 動作]
  const TFX={spo2:['clip','wristL'],bp:['cuff','armL','pump'],gluco:['meter','wristL','poke'],torch:['torch','face','light'],steth:['steth','chest','circle'],thermo:['thermo','head'],ecg:['pads','chest'],
    nc:['mask','face'],mask:['mask','face'],nrm:['mask','face'],ven:['mask','face'],bvm:['bvm','face','squeeze'],opa:['tube','mouth'],npa:['tube','mouth'],suction:['tube','mouth','suck'],lt:['tube','mouth','push'],lma:['tube','mouth','push'],combi:['tube','mouth','push'],
    aed:['pads','chest'],accm:['box','chest'],io:['drill','shinL','drill'],ivset:['bag','wristL'],ns:['bag','wristL'],d10:['cup','mouth','tilt'],asa:['pill','mouth'],charc:['cup','mouth','tilt'],
    ntg:['inhaler','mouth','puff'],salb:['inhaler','mouth','puff'],ipra:['inhaler','mouth','puff'],penth:['whistle','mouth','puff'],
    thia:['syringe','wristL','push'],adr:['syringe','wristL','push'],amio:['syringe','wristL','push'],txa:['syringe','wristL','push'],
    gluc:['syringe','thighL','push'],nalox:['syringe','thighL','push'],mida:['syringe','thighL','push'],jext:['syringe','thighL','push'],piri:['syringe','thighL','push'],trama:['syringe','thighL','push'],olz:['syringe','thighL','push'],
    tq:['tq','thighL','twist'],hd:['gauze','thighL','press'],gauze:['gauze','thighL','press'],splint:['splint','shinR'],sager:['splint','shinR'],tpod:['tq','pelvis','twist'],collar:['collar','neck'],board:['board','belly'],
    burn:['gauze','armR'],water:['cup','armR','pour'],foil:['foil','belly'],wrap:['foil','belly'],hotpack:['gauze','belly'],ppe:['glove','crew'],chair:['box','crew'],phone:['phone','crew']};
  function spawnDrop(pos,col,vy){ const o=add(sph(0.025),mat(col,{op:0.8}),scene,pos.x+(Math.random()-0.5)*0.1,pos.y,pos.z+(Math.random()-0.5)*0.1,false); tfx.push({o,t:0,d:0.7,f:(o,k)=>{ o.position.y+=vy*0.016; o.material.opacity=0.8*(1-k); }}); }
  function toolAnim(id,part,done){ const sp=TFX[id]||['gauze','chest']; const {c1,c2}=C(); const front=['face','mouth','head'].includes(part||sp[1]); const cr=front?c1:c2;
    const g=MINI[sp[0]](); const SC=({syringe:2.6,pill:3,cup:2.2,inhaler:2.4,whistle:2.4,phone:2.4,thermo:2.2,clip:2,meter:2,drill:2,glove:2,torch:1.8})[sp[0]]||1.6; g.scale.setScalar(SC); scene.add(g); const tgtPart=part||sp[1];
    const from=cr.getWorldPosition(V()).add(V(0,1.3,0)), to=tgtPart==='crew'?cr.getWorldPosition(V()).add(V(0,2.3,0)):pw(tgtPart).add(V(0,0.5,0));
    g.position.copy(from); let fired=false; const mode=sp[2];
    tfx.push({o:g,t:0,d:2.3,keep:1,f:(o,k)=>{ const T=k*2.3;
      if(T<0.8){ const u=T/0.8; o.position.lerpVectors(from,to,u); o.position.y+=Math.sin(u*Math.PI)*0.5; }
      else if(T<1.9){ const u=(T-0.8)/1.1; o.position.copy(to);
        if(mode==='push'){ o.position.y=to.y-Math.min(1,u*2)*0.14; if(o.userData.pl) o.userData.pl.position.y=0.16-Math.min(1,u*1.5)*0.09; }
        else if(mode==='puff'&&Math.random()<0.35) spawnDrop(to,0xffffff,0.6);
        else if(mode==='pour'&&Math.random()<0.6) spawnDrop(to,0x7ec8ff,-1.2);
        else if(mode==='suck'&&Math.random()<0.2) spawnDrop(to,0xeeeecc,0.3);
        else if(mode==='circle'){ o.position.x=to.x+Math.cos(u*9)*0.18; o.position.z=to.z+Math.sin(u*9)*0.18; o.position.y=to.y-0.1; }
        else if(mode==='light'){ o.lookAt(pw('face')); if(o.userData.cone) o.userData.cone.visible=Math.sin(u*30)>-0.6; }
        else if(mode==='pump'||mode==='squeeze'){ const s=SC*(1+Math.abs(Math.sin(u*14))*0.15); o.scale.set(s,s,s); }
        else if(mode==='press'||mode==='poke'){ o.position.y=to.y-0.08-Math.abs(Math.sin(u*8))*0.04; }
        else if(mode==='twist'){ o.rotation.y=u*6; }
        else if(mode==='drill'){ o.rotation.y=u*30; o.position.y=to.y-u*0.1; }
        else if(mode==='tilt'){ o.rotation.z=-u*1.2; if(Math.random()<0.3) spawnDrop(to,0xfff2a0,-0.8); }
        else o.position.y=to.y-u*0.12;
        if(!fired&&u>0.5){ fired=true; try{ done&&done(); }catch(e){} } }
      else { const u=(T-1.9)/0.4; o.scale.setScalar(SC*Math.max(0.01,1-u)); } }});
    focus=tgtPart==='crew'?focus:tgtPart; }
  // 擋住鏡頭嘅細物件（燈柱、路牌、樹）暫時隱藏
  const occ=new Set(), occI=new Map(); let occT=0; const RCs=new THREE.Raycaster();
  const ours=o=>{ for(let x=o;x;x=x.parent){ if(x===patient||x===crew||(typeof amb!=='undefined'&&x===amb)||(x.userData&&x.userData.sim)) return true; } return false; };
  function occTick(){ const now=performance.now(); if(now-occT<200) return; occT=now; const CM=window.__cam; if(!CM) return;
    const tgt=pw(focus).add(V(0,0.6,0)), from=CM.position.clone(), dir=tgt.clone().sub(from), L=dir.length(); if(L<1) return; dir.normalize(); RCs.set(from,dir); RCs.far=L-0.6;
    let hits=[]; try{ hits=RCs.intersectObjects(scene.children,true); }catch(e){} const cur=new Set();
    for(const h of hits){ const o=h.object; if(!o.isMesh||ours(o)) continue;
      if(o.isInstancedMesh){ if(h.instanceId==null) continue; const key=o.uuid+':'+h.instanceId; if(!occI.has(key)){ const m=new THREE.Matrix4(); o.getMatrixAt(h.instanceId,m); const z=m.clone().multiply(new THREE.Matrix4().makeScale(0.0001,0.0001,0.0001)); o.setMatrixAt(h.instanceId,z); o.instanceMatrix.needsUpdate=true; occI.set(key,{o,i:h.instanceId,m,t:now}); } else occI.get(key).t=now; continue; } const g=o.geometry; if(!g) continue; if(!g.boundingSphere) g.computeBoundingSphere(); const sc=o.getWorldScale(V()); if(g.boundingSphere.radius*Math.max(sc.x,sc.y,sc.z)>7) continue; cur.add(o); }
    occ.forEach(o=>{ if(!cur.has(o)){ o.visible=true; occ.delete(o); } }); cur.forEach(o=>{ if(o.visible){ o.visible=false; occ.add(o); } });
    occI.forEach((v,k)=>{ const P=new THREE.Vector3().setFromMatrixPosition(v.m).applyMatrix4(v.o.matrixWorld); const q=P.clone().sub(from), tt=Math.max(0,Math.min(L,q.dot(dir))), dd=q.sub(dir.clone().multiplyScalar(tt)); dd.y=0; if(dd.length()<1.2) v.t=now; if(now-v.t>800){ v.o.setMatrixAt(v.i,v.m); v.o.instanceMatrix.needsUpdate=true; occI.delete(k); } }); }
  function occClear(){ occ.forEach(o=>o.visible=true); occ.clear(); occI.forEach(v=>{ v.o.setMatrixAt(v.i,v.m); v.o.instanceMatrix.needsUpdate=true; }); occI.clear(); }
  function tfxTick(dt){ occTick(); for(let i=tfx.length-1;i>=0;i--){ const f=tfx[i]; f.t+=dt; f.f(f.o,Math.min(1,f.t/f.d)); if(f.t>=f.d){ scene.remove(f.o); tfx.splice(i,1); } } }
  function useTool(id,text){ const {c1,c2}=C(); const k=TOOLACT[id]||'kit', vk=CASE&&CASE.vk, cid=CASE&&CASE.id;
    const front=['o2:nc','o2:mask','o2:nrm','o2:ven','bvm','spray','whistle','pill','tap','radio'].includes(k);
    if(!document.body.classList.contains('simScene')) return;
    act=ALIAS[k]||k; at=0;
    const woundPart=cid==='hd'?(CASE.varK==='neck'?'neck':CASE.varK==='chest'?'chest':'face'):cid==='hat'&&CASE.varK==='groin'?'pelvis':'thighL';
    const part=(id==='hd'||id==='gauze')?woundPart:(id==='burn'||id==='water')?(cid==='burn'&&CASE.varK==='face'?'face':'armR'):null;
    const build=()=>{ if(id==='spo2'){ if(!has('clip')) onPat(new THREE.BoxGeometry(0.1,0.08,0.12),mat(0xd62828),'wristL',0,0.05,0.12,0,0,0,'clip'); G.monitor(); }
      if(id==='bp'){ G.cuff(); G.monitor(); } if(id==='gluco') G.monitor(); if(id==='ecg') G.electrodes();
      if(k.startsWith('o2:')) G.mask(k.slice(3)); if(['bvm','lt','lma','combi'].includes(id)){ G.bvm(); ventOn=true; }
      if(id==='aed') G.pads(); if(id==='accm'){ G.accm(); cpr=true; }
      if(['ivset','ns','io'].includes(id)) G.ivbag();
      if(id==='tq') G.tourniquet('thighL');
      if(id==='hd'||id==='gauze') G.gauze(woundPart==='face'?'head':woundPart);
      if(id==='splint') G.splint(false); if(id==='sager') G.splint(true); if(id==='tpod') G.tpod(); if(id==='collar') G.collar(); if(id==='burn') G.burn(); if(['foil','wrap','hotpack'].includes(id)) G.foil(); };
    toolAnim(id,part,build);
    bubble(crewHead(front?c1:c2),text,2.6); }
  return {resetView,useTool,setCase,react,focusOn,play,apply,tick,cam,enter,leaveScene,clear,bubble,get cpr(){ return cpr; },_k:kindOf};
})();

/* ---------- 🧰 現場模擬：救護器材／藥物工具列（分類、每步需要嘅工具、讀數） ---------- */
const SIMTOOLS=(()=>{
  // kind: a=評估（隨時用、唔扣分） d=器材（用咗會留喺病人身上） m=藥物（每次用都要再揀）
  const CAT=[['assess','🩺 評估'],['air','🫁 氣道／氧氣'],['cpr','⚡ 復甦'],['drug','💊 藥物'],['trauma','🩹 創傷'],['other','📦 其他']];
  const T={
    spo2:['☝️','血氧機 SpO₂','assess','a'], bp:['💪','血壓計','assess','a'], gluco:['🩸','血糖機 H\'stix','assess','a'], torch:['🔦','電筒（睇瞳孔）','assess','a'],
    steth:['🎧','聽筒','assess','a'], thermo:['🌡️','體溫計','assess','a'], ecg:['📈','DM 機 12 導程','assess','d'],
    nc:['👃','鼻插喉','air','d'], mask:['😷','簡單面罩','air','d'], nrm:['🫧','NRM 不能回吸面罩','air','d'], ven:['🎚️','文氏面罩','air','d'], bvm:['🎈','BVM 膠囊活門面罩','air','d'],
    opa:['🦷','OPA 口咽氣道','air','d'], npa:['👃','NPA 鼻咽氣道','air','d'], suction:['🌀','抽痰機','air','d'], lt:['🟥','LTS-D 喉管','air','d'], lma:['🟩','LMA Supreme','air','d'], combi:['🟦','Combitube','air','d'],
    aed:['⚡','AED／DM 電擊片','cpr','d'], accm:['🤖','ACCM 胸外按壓機','cpr','d'], io:['🪛','IO 骨內注射鑽','cpr','d'],
    asa:['💊','ASA 阿士匹靈','drug','m'], ntg:['💨','NTG 脷底噴劑','drug','m'], salb:['🌬️','Ventolin (Salbutamol)','drug','m'], ipra:['🌬️','Atrovent (Ipratropium)','drug','m'],
    d10:['🧃','D10W 葡萄糖水','drug','m'], ns:['💧','0.9% NS 鹽水','drug','d'], ivset:['🩻','IV 套裝（3-way）','drug','d'], thia:['💉','Thiamine','drug','m'], gluc:['💉','Glucagon','drug','m'],
    nalox:['💉','Naloxone','drug','m'], charc:['⚫','活性炭','drug','m'], mida:['💉','Midazolam','drug','m'], jext:['💉','Jext／EpiPen','drug','m'], piri:['💉','Piriton','drug','m'],
    trama:['💉','Tramadol','drug','m'], txa:['💉','TXA 傳明酸','drug','m'], olz:['💉','Olanzapine','drug','m'], penth:['🟢','Penthrox 綠哨子','drug','m'],
    adr:['💉','Adrenaline 1 mg','drug','m'], amio:['💉','Amiodarone','drug','m'],
    tq:['🎗️','HAT 止血帶','trauma','m'], hd:['🧻','止血敷料 (HD)','trauma','d'], gauze:['🩹','敷料繃帶','trauma','d'], splint:['🦴','真空夾板','trauma','d'], sager:['🦿','Sager 牽引夾板','trauma','d'],
    tpod:['🎽','T-POD 骨盆帶','trauma','d'], collar:['🧣','頸套','trauma','d'], board:['🛏️','剷床／脊椎板','trauma','d'], burn:['🧊','燒傷敷料 Burnkit','trauma','d'], water:['🚿','清水（沖洗）','trauma','m'],
    foil:['🥡','保溫毯','trauma','d'], wrap:['🧥','紅毯／毛氈','trauma','d'], hotpack:['🔥','Hot Pack','trauma','d'],
    ppe:['🧤','PPE／N95','other','d'], chair:['🪑','搬運椅','other','d'], phone:['📞','電話（通報／HKPIC）','other','m']
  };
  const NO=/^(唔可以|唔使|未可以|唔需要|暫時唔可以|冇|唔應)/;
  // 呢啲題目係問知識，唔係叫你即刻做
  const KNOW=/係？$|係邊|係咪|幾耐|代表|提示|要諗起|要留意咩|仲要留意|仲可以考慮|適用症|邊一類|點判斷|邊間|邊個|口訣|次序|包括|取代|幾時|條件|要注意咩|有咩效果/;
  // 回傳需要嘅工具：[[可選 id…], …]，每組揀一樣
  function need(c,lv){ if(!c||!c.q||c.k==='MIST') return []; const ans=c.q.o[0]||'', act=c.act||'', q=c.q.q||'', T2=act+' '+ans, g=[];
    if(c.tools) return c.tools;
    if(lv==='burn'&&/唔可以全部蓋/.test(ans)) return [['burn'],['foil']];
    if(c.k==='LG') return [];
    if(c.k==='CALL') return [['phone']];
    if(NO.test(ans)) return [];
    const add=(...ids)=>{ if(!g.some(x=>x.join()===ids.join())) g.push(ids); };
    switch(c.k){
      case 'VS': if(!/回流灌注/.test(ans)) { add('bp'); add('spo2'); } return g;
      case 'HS': add('gluco'); return g;
      case 'O2': add('spo2'); if(/BVM/.test(ans)) add('bvm'); else if(/NRM|不能回吸/.test(ans)) add('nrm'); else if(/文氏/.test(ans)) add('ven'); else if(/鼻插喉|簡單面罩/.test(ans)) add('nc','mask'); return g;
      case 'CAB': if(/OPA/.test(ans)) add('opa','npa'); if(/BVM|Bag/.test(ans)) add('bvm'); if(/Suction|SuctioN|抽吸/.test(ans)) add('suction'); if(/OxygeN|俾氧/.test(ans)) add('nrm','mask','nc'); return g;
      case 'RBS': if(/瞳孔/.test(c.find||'')) add('torch'); return g;
      case 'CPR': add('bvm'); return g;
      case 'AED': add('aed'); return g;
      case 'AW': if(/ACCM|continuous/.test(T2)) return g; add(lv==='lt'?'lt':lv==='lma'?'lma':lv==='combi'?'combi':'bvm'); return g;
    }
    if(lv==='accm'&&c.k==='TX'&&/^可以/.test(ans)) add('accm');
    if(lv==='burn'&&/^可以用/.test(ans)) add('burn');
    if(lv==='ecg12'&&/貼電極/.test(ans)) add('ecg');
    if(KNOW.test(q)&&!/點處理|點做|點俾|劑量/.test(q)) return g;
    if(/ASA|阿士匹靈/.test(T2)&&/200 mg/.test(ans)) add('asa');
    if(/NTG/.test(T2)&&/0\.4 mg|第 2 劑/.test(ans)) add('ntg');
    if(/嘗試使用 Penthrox/.test(ans)) add('penth');
    if(/puffs/.test(ans)) add(/Atrovent|Ipratropium/.test(act)?'ipra':'salb');
    if(/Ventolin/.test(ans)) add('salb');
    if(/口服 D10W|再口服|飲 D10W/.test(ans)) add('d10');
    if(/IV D10W/.test(ans)){ add('ivset'); add('d10'); }
    if(/^Thiamine/.test(ans)) add('thia');
    if(/NS |NS$|^NS|500 ml Full Rate|100 ml／hr|500 ml／hr/.test(ans)&&!/D10W/.test(ans)){ add('ivset'); add('ns'); }
    if(/Glucagon/.test(ans)&&/mg/.test(ans)) add('gluc');
    if(/Naloxone/.test(ans)&&/mg/.test(ans)) add('nalox');
    if(/活性炭/.test(ans)&&/50 g/.test(ans)) add('charc');
    if(/Midazolam/.test(T2)&&/mg/.test(ans)||lv==='fit'&&/^\d.*mg（/.test(ans)||/俾 1st Midazolam/.test(ans)) add('mida');
    if(/Jext|EpiPen/.test(ans)&&/mg|第二支/.test(ans)) add('jext');
    if(lv==='ana'&&/Piriton|Chlorphen/.test(act)&&/mg/.test(ans)) add('piri');
    if(/Tramadol/.test(act)&&/mg/.test(ans)) add('trama');
    if(/每分鐘 100 mg|剩下劑量/.test(ans)) add('txa');
    if(/Olanzapine/.test(act)&&/mg/.test(ans)) add('olz');
    if(/3 ml，Only One Dose/.test(ans)) add('penth');
    if(lv==='adr'&&/1 mg（10 ml）|第一劑 Adrenaline|第 2 劑 Adrenaline/.test(ans)) add('adr');
    if(/骨內注射|\(IO\)/.test(ans)) add('io');
    if(lv==='amio'&&/300 mg|150 mg/.test(ans)&&!/條件/.test(act)) add('amio');
    if(/Amiodarone 1st 300/.test(ans)) add('amio');
    if(/12 導聯|12-Lead|肋間/.test(ans)) add('ecg');
    if(c.k==='BLEED'&&/止血帶|並排紮|近端/.test(ans)) add('tq');
    if(/止血敷料|敷料按入|按壓入傷口/.test(ans)&&!/Burnkit|燒傷|考慮/.test(ans)) add('hd');
    if(/夾板固定/.test(ans)) add('splint');
    if(lv==='sager'&&c.k==='SPL'&&/磅|複查/.test(ans)) add('sager');
    if(/腰帶|兩邊滑輪|先上板/.test(ans)) add('tpod');
    if(/先上板/.test(ans)) add('board');
    if(/完整的脊柱制動/.test(ans)){ add('collar'); add('board'); }
    if(/沖約|大量清水沖洗/.test(ans)) add('water');
    if(/燒傷敷料|Burnkit|局部敷料/.test(ans)&&!/唔可以/.test(ans)) add('burn');
    if(/Hypothermia Wrap|保溫毯/.test(ans)){ add('foil'); add('wrap'); }
    if(/毛氈包裹/.test(ans)) add('wrap');
    if(/放入嘔吐袋/.test(ans)) add('hotpack');
    if(/^致電|^直接致電/.test(ans)) add('phone');
    if(/ACCM|30:2、深度/.test(ans)&&lv==='accm') add('accm');
    if(/PPE|N95/.test(ans)) add('ppe');
    return g; }
  // 評估工具嘅讀數（入門、專業都可以隨時用）
  function reading(id,sc,v){ const l=sc.id, r=v.rhythm, dead=r==='vf'||r==='asys'||(r==='pea'&&!v.hr);
    switch(id){
      case 'spo2': return dead?'SpO₂：冇波形':(l==='o2'&&sc.varK==='co'?'SpO₂ '+Math.round(v.spo2)+'%（一氧化碳中毒，讀數唔可信）':'SpO₂ '+Math.round(v.spo2)+'%');
      case 'bp': return dead?'BP：量唔到':(l==='lvad'?'BP：量唔到穩定讀數（LVAD）':'BP '+Math.round(v.sbp)+'／'+Math.round(v.dbp||v.sbp*0.62));
      case 'gluco': return "H'stix "+(+v.rbs).toFixed(1)+' mmol/L';
      case 'torch': return l==='narc'?'瞳孔：兩邊針孔狀 (Pin point)':l==='stroke'?'瞳孔：等大，雙眼偏向一邊':dead?'瞳孔：放大、對光冇反應':v.avpu>=2?'瞳孔：等大，對光反應遲緩':'瞳孔：等大、對光有反應';
      case 'steth': return l==='resp'?(sc.varK==='copd'?'肺音：兩邊有喘鳴，入氣減少':'肺音：兩邊有喘鳴'):l==='ana'?(sc.varK==='ac'?'肺音：清晰，冇喘鳴':'肺音：有喘鳴'):l==='combi'&&sc.varK==='tra'?'#1 藍管：肺冇聲，胃有咕嚕聲':dead?'冇呼吸音':l==='burn'&&sc.varK==='face'?'肺音：清；聲沙，有喘鳴風險':'肺音：兩邊清晰、入氣平均';
      case 'thermo': return 'T '+(l==='hypot'&&sc.varK!=='frost'?'32.4':l==='olz'?'39.8':l==='hypovol'&&sc.varK==='heat'?'38.6':l==='o2'&&sc.varK==='gen'?'38.4':'36.8')+' °C';
      case 'ecg': return dead?(r==='vf'?'ECG：VF':r==='asys'?'ECG：Asystole（直線）':'ECG：有電流、冇脈搏 (PEA)'):'ECG：'+(r==='brady'?'竇性心動過緩':r==='tachy'?'竇性心動過速':r==='noise'?'雜訊（抽搐中）':'竇性心律')+' '+Math.round(v.hr);
    } return ''; }
  return {CAT,T,need,reading};
})();

/* ---------- 📋 現場模擬：個案細節（SAMPLE、現場道具）、注意事項、個案卡 ---------- */
const SIMNOTES=(()=>{
  // SAMPLE：S 徵狀 · A 敏感 · M 藥物 · P 病歷 · L 最後進食 · E 經過；props：現場 3D 道具；safe：行動注意事項
  const D={
    chest:k=>({S:'胸口中間壓住咁痛 8／10，傳去左手，出冷汗、有啲氣促',A:'冇藥物敏感',M:k==='nontg'?'降血壓藥、降膽固醇藥':'Isordil（NTG）、降血壓藥'+(k==='asa24'?'；今朝自己食咗一粒阿士匹靈':''),P:'高血壓、三年前心絞痛',L:'兩個鐘前食咗早餐',E:'行樓梯上二樓時開始痛，坐低休息 20 分鐘都唔減',props:['chair','pillbox'],
      safe:['病人可能隨時心臟驟停：AED 擺喺身邊，電擊片準備好。','用 NTG 前一定要量 BP，並問 72 小時內有冇用壯陽藥。','唔好俾病人自己行落樓，用搬運椅。']}),
    resp:k=>({S:'氣促、講嘢斷斷續續、有喘鳴',A:'冇藥物敏感',M:k==='copd'?'Ventolin、Atrovent、家用氧氣':'Ventolin 噴劑'+(k==='glau'?'、青光眼眼藥水':''),P:k==='copd'?'COPD、長期食煙':'哮喘'+(k==='preg'?'；懷孕 28 星期':''),L:'午餐',E:'今日天氣轉凍，氣促慢慢加劇，自己噴咗 2 下 Ventolin 冇改善',props:['inhaler'],
      safe:['讓病人坐直、身向前傾，唔好強迫佢瞓低。','COPD 病人氧氣目標 88–92%，唔好一下俾太高濃度。','留意病人愈嚟愈眼瞓、講唔到嘢：可能呼吸衰竭，要準備 BVM。']}),
    hypo:k=>({S:k==='high'?'口乾、多尿、神志不清':'神志不清、冒冷汗、手震',A:'冇藥物敏感',M:'胰島素（Insulin）、Metformin',P:'糖尿病 15 年',L:k==='high'?'今日食咗好多甜嘢':'今朝打完針冇食早餐',E:'家人發現佢答非所問',props:['insulin','glucometer'],
      safe:['唔清醒病人唔可以餵嘢食，會哽塞。','IV 前要確認靜脈通暢，D10W 外滲會傷組織。','血糖改善後都要送院，長效胰島素可能令血糖再跌。']}),
    glucagon:k=>({S:'暈暈沉沉、冒汗、講嘢含糊',A:'冇藥物敏感',M:'胰島素'+(k==='pheo'?'、Phenoxybenzamine（嗜咯細胞瘤）':''),P:'糖尿病'+(k==='pheo'?'、嗜咯細胞瘤':''),L:'今朝冇食嘢',E:'朋友見佢喺公園長櫈坐咗好耐冇反應',props:['insulin'],
      safe:['IV 試 3 次都唔得先考慮 Glucagon。','Glucagon 生效要 10–15 分鐘，期間保持氣道暢通、側臥防嘔吐。']}),
    narc:k=>({S:'昏迷、呼吸好慢好淺、鼻鼾聲',A:'不詳',M:k==='young'?'（阿爺嘅美沙酮）':'不詳',P:k==='young'?'冇':'旁人話佢有吸毒',L:'不詳',E:k==='young'?'家人話佢可能誤飲咗阿爺放喺枱面嘅美沙酮':'旁人發現佢喺後樓梯坐低之後慢慢瞓低',props:k==='young'?['bottle']:['syringe','syringe','bottle'],
      safe:['小心地上針筒，唔好徒手執，用利器收集箱。','Naloxone 之後病人可能突然醒、好激動或者嘔吐，預備抽痰同保持距離。','Naloxone 作用可能短過麻醉藥，就算醒咗都一定要送院。']}),
    charcoal:k=>({S:'暫時冇明顯不適',A:'冇藥物敏感',M:'撲熱息痛（Panadol）',P:'抑鬱症',L:'晚飯',E:k==='late'?'約 3 小時前食咗 20 粒撲熱息痛':'約 1 小時前食咗 20 粒撲熱息痛',props:['bottle','pillbox'],
      safe:['藥樽、藥袋帶埋上車交俾醫院。','病人有自殺念頭：唔好留低佢一個人，留意現場有冇其他危險物品。','清醒程度一旦下降就唔可以俾活性炭。']}),
    fit:k=>({S:'全身抽搐、口有分泌物',A:'冇藥物敏感',M:'抗癲癇藥（今日冇食）',P:'癲癇',L:'午餐',E:'朋友見佢喺巴士站突然倒地抽搐，已經大約 3 分鐘',props:['bag'],
      safe:['唔好塞嘢入病人口，唔好強行按住手腳。','移開附近硬物，保護頭部。','記錄抽搐開始、停止同用藥時間。','抽搐停咗之後擺復原臥式，預備抽痰。']}),
    ana:k=>({S:'全身出疹、嘴唇腫、'+(k==='ac'?'頭暈':'喉嚨緊、氣促'),A:'對蝦敏感（以前出過疹）',M:k==='own'?'自己嘅 EpiPen × 2':'冇長期用藥',P:'食物敏感',L:'15 分鐘前食咗蝦',E:'食完蝦幾分鐘開始痕、出疹，之後頭暈',props:['plate'],
      safe:['血壓低就瞓平、抬高雙腳；氣促就坐起，唔好突然企起身。','病情可以好快轉差，就算好返都要送院觀察。','記錄每支 Jext／EpiPen 嘅時間，用過嘅交俾醫院。']}),
    hypovol:k=>({S:k==='bleed'?'大腿大量出血、頭暈':k==='heat'?'頭暈、大量出汗':'虛弱、頭暈',A:'冇藥物敏感',M:'冇',P:k==='dehyd'?'高血壓':'冇',L:k==='heat'?'朝早食咗少少，水飲得少':'嘔吐後冇食嘢',E:k==='bleed'?'電單車撞欄跌落地':k==='heat'?'炎熱天時行咗 4 個鐘山':'嘔吐肚瀉兩日',props:k==='bleed'?['helmet','blood']:k==='heat'?['bag']:['bucket'],
      safe:['大量出血先止血，止血比打 IV 更重要。','唔好喺現場拖延打 IV，儘早送院。','病人瞓平保暖，防體溫過低。']}),
    tramadol:k=>({S:'右小腿劇痛 9／10、變形',A:'冇藥物敏感',M:k==='epi'?'抗癲癇藥':'冇',P:k==='epi'?'癲癇':'冇',L:'午餐',E:'喺屋苑樓梯踩空跌倒',props:[],
      safe:['用藥前排除 CHEAP PAIN 禁忌。','打完針 15 分鐘內留意反胃、頭暈、血壓下降。','上夾板前後檢查遠端循環神經。']}),
    txa:k=>({S:'下半身劇痛、好虛弱',A:'冇藥物敏感',M:'冇',P:'冇',L:'早餐',E:(k==='late'?'約 4 小時前':'約 40 分鐘前')+'喺地盤被重物壓住下半身',props:['helmet','blood'],
      safe:['懷疑盆骨骨折：盡量少移動，用剷床。','TXA 慢慢推，每分鐘 100 mg，太快會低血壓。','途中留意抽搐同心搏停止。']}),
    olz:k=>({S:'情緒激動、大叫、揮拳、全身出汗',A:'不詳',M:'不詳',P:'旁人話佢有精神病',L:'不詳',E:'喺街大叫揮拳，途人報警',props:[],
      safe:['安全第一：保持距離，等警員到場先接近。','制服時唔好壓住胸口同頸，防窒息。','用藥後持續監察呼吸、SpO₂ 同體溫。']}),
    penthrox:k=>({S:'右腳踝腫痛 8／10',A:'冇藥物敏感',M:'冇',P:k==='kidney'?'慢性腎病':k==='preg'?'懷孕 20 星期':'冇',L:k==='bp'?'朝早食咗少少，行咗 5 個鐘冇點飲水':'午餐',E:'行山落樓梯級時扭傷腳踝',props:['bag'],
      safe:['病人自己握住 Penthrox 吸，唔好替佢按住。','救護員自己唔好吸到：車上開窗通風。','用搬運椅落山，小心路面濕滑。']}),
    o2:k=>({S:k==='co'?'頭痛、嘔吐':k==='para'?'喉嚨痛、嘔吐':'氣促、咳嗽',A:'冇藥物敏感',M:k==='copd'?'Ventolin、Atrovent':'冇',P:k==='copd'?'COPD':'冇',L:'晚餐',E:k==='co'?'喺密閉房燒炭':k==='para'?'飲咗殺草水（百草枯）':'發燒咳嗽三日',props:k==='co'?['stove']:k==='para'?['bottle']:[],
      safe:k==='co'?['先確保現場通風，移走炭盆先入去。','SpO₂ 讀數唔可信，照俾高濃度氧氣。']:k==='para'?['穿 PPE 同戴 N95。','百草枯病人唔好俾太多氧，會加重肺損傷。']:['按 SpO₂ 調氧，唔好一開就最大。','COPD 病人目標 88–92%。']}),
    aed:k=>({S:'冇反應、冇呼吸',A:'不詳',M:'不詳',P:k==='child'?'冇':'高血壓',L:'不詳',E:'喺商場突然暈低，旁人即刻做 CPR',props:[],
      safe:['電擊前大聲講「所有人離開」，確認冇人掂病人。','盡量唔好停 CPR，每 2 分鐘換人按。','小童用小童電擊片或者 50 J。']}),
    adr:k=>({S:'冇反應、冇呼吸',A:'不詳',M:'降血壓藥',P:'高血壓、糖尿病',L:'晚飯',E:k==='trapped'?'喺廁所暈低，門反鎖':'家人發現佢喺客廳暈低',props:[],
      safe:['用藥唔可以影響 CPR 質素。','記錄每劑 Adrenaline 時間。','病人被困：唔中斷基本生命支持下可以喺現場用藥。']}),
    amio:k=>({S:'冇反應、冇呼吸',A:'不詳',M:'不詳',P:'不詳',L:'不詳',E:'喺健身室跑步機上暈低，職員用緊 AED',props:[],
      safe:['數清楚電擊次數同 Adrenaline 劑數先俾 Amiodarone。','推完要用 NS 沖管。']}),
    aedp:k=>({S:'冇反應、冇呼吸',A:'不詳',M:'不詳',P:'心臟病',L:'不詳',E:'現場已經用緊其他 AED',props:[],
      safe:['現場 AED 分析或電擊緊就唔好掂。','關機但唔好撕走電擊片。','之前嘅電擊次數唔計入我哋嘅 AED Protocol。','SAED Corpuls1 冇壞就繼續用佢上車；壞咗（不可在救護車上使用）就轉 DM，SD Card 交救護車主管。']}),
    accm:k=>({S:'冇反應、冇呼吸',A:'不詳',M:'不詳',P:k==='preg'?'懷孕約 30 星期':'冠心病',L:'不詳',E:'家人發現佢暈低，做緊 CPR',props:[],
      safe:['安裝 ACCM 唔好停 CPR 超過 10 秒。','搬運時留意 ACCM 位置有冇移位。']}),
    lt:k=>({S:'冇反應、冇呼吸',A:'不詳',M:'不詳',P:'不詳',L:'不詳',E:k==='corr'?'旁邊有一樽渠水':'家人做緊 CPR',props:k==='corr'?['bottle']:[],
      safe:['插喉唔好停 CPR 超過 10 秒。','插完聽兩邊肺同胃，接 Filter。']}),
    lma:k=>({S:'冇反應、冇呼吸',A:k==='swell'?'對海鮮敏感':'不詳',M:'不詳',P:'不詳',L:k==='swell'?'啱啱食完海鮮':'不詳',E:k==='swell'?'食完海鮮嘴唇腫、氣促之後暈低':'喺街暈低，路人做 CPR',props:[],
      safe:['用一隻手固定 LMA，搬運時特別小心。','不論成功與否都要填 LMA Supreme 表格。']}),
    combi:k=>({S:'冇反應、冇呼吸、口腔回湧',A:'不詳',M:'不詳',P:'不詳',L:'不詳',E:'家人做緊 CPR',props:[],
      safe:['用 Combitube 前準備抽痰機。','每次換管都要聽肺同胃確認。']}),
    dnacpr:k=>({S:'冇反應、冇呼吸',A:'不詳',M:'止痛藥',P:{valid:'腦轉移腫瘤',choke:'末期肺癌',expired:'阿茲海默症',dispute:'晚期 COPD'}[k],L:k==='choke'?'食緊湯圓':'不詳',E:'家人發現冇反應',props:['bed'],
      safe:['分工：一人檢查病人，一人查核命令。','如有懷疑，救人第一。','尊重家屬情緒，清楚解釋決定。']}),
    hat:k=>({S:(k==='groin'?'腹股溝':'左大腿')+'大量噴血、頭暈',A:'冇藥物敏感',M:'冇',P:'冇',L:'午餐',E:'被工廠機器割傷',props:['blood'],
      safe:['確認機器已關先接近。','止血帶紮好要記時間，唔好用衫褲蓋住。','唔好喺關節位紮止血帶。']}),
    hd:k=>({S:{neck:'頸側',chest:'胸口',eye:'眼'}[k]+'傷口大量出血',A:'冇藥物敏感',M:'冇',P:'冇',L:'晚餐',E:'被玻璃割傷',props:['glass','blood'],
      safe:['小心玻璃碎，戴好手套。','頸部傷口唔好用環形包紮壓住氣管。','止血敷料用完要記錄用咗幾多袋。']}),
    tpod:k=>({S:'盤骨好痛、下肢無力',A:'冇藥物敏感',M:'冇',P:'冇',L:'午餐',E:'過馬路被私家車撞到',props:[],
      safe:['唔好搖盆骨測試穩唔穩定。','用剷床，唔好滾動病人。','記錄上 T-POD 時間。']}),
    sager:k=>({S:'右大腿劇痛、變形',A:'冇藥物敏感',M:'冇',P:'冇',L:'早餐',E:'電單車意外',props:['helmet'],
      safe:['除頭盔要兩個人做，保持頸部中線。','牽引前後都要檢查遠端循環神經。']}),
    spinal:k=>({S:k==='walk'?'頸少少硬':'頸背痛',A:'冇藥物敏感',M:k==='old'?'降血壓藥':'冇',P:k==='old'?'骨質疏鬆':'冇',L:'午餐',E:{walk:'私家車追尾',old:'喺樓梯跌落嚟',drunk:'飲醉酒跌落樓梯',fall:'由 7 米高棚架墮下'}[k],props:k==='drunk'?['bottle']:k==='fall'?['helmet']:[],
      safe:['評估期間一直保持頭鎖。','醉酒、長者、高處墮下都要完整脊柱制動。']}),
    burn:k=>({S:'燒傷位好痛',A:'冇藥物敏感',M:'冇',P:'冇',L:'晚餐',E:{scald:'倒熱水時燙傷右手臂',chem:'工廠化學品濺到前臂',face:'廚房火警',big:'火警'}[k],props:k==='scald'?['kettle']:k==='chem'?['bottle']:[],
      safe:['先確保自己唔會被燒傷或化學品沾到。','除去燒傷位附近首飾，黐住皮膚嘅衫唔好撕。','冷水沖唔好超過 10 分鐘，防體溫過低。']}),
    hypot:k=>({S:k==='frost'?'左手手指冰冷麻木、轉灰白':'發冷、講嘢含糊',A:'冇藥物敏感',M:'冇',P:'冇',L:k==='cold'?'琴日下晝':'午餐',E:{imm:'跌落海，救起後全身濕透',cold:'喺大帽山迷路一晚',frost:'喺山頂寒風中耽咗幾個鐘'}[k],props:k==='imm'?['towel']:['bag'],
      safe:['搬動要輕，嚴重低溫病人好容易心律不正。','唔好搓揉手腳，唔好直接加熱。','睇落似死亡都要繼續復甦直至醫生確認。']}),
    ecg12:k=>({S:'胸口痛',A:'冇藥物敏感',M:'降血壓藥',P:'高血壓',L:'晚餐',E:'坐喺屋企睇電視時開始胸口痛',props:['chair'],
      safe:['貼電極前講原因、取得同意。','女病人要注意私隱。','傳輸唔成功唔好耽誤送院。']}),
    stroke:k=>({S:'右手右腳無力、講嘢含糊、口角歪',A:'冇藥物敏感',M:'降血壓藥、薄血藥',P:'高血壓、心房顫動',L:'晚飯',E:k==='late'?'琴晚瞓前仲正常，今朝先發現':'食飯時突然發生',props:['chair'],
      safe:['記低最後正常時間（Last Known Well）。','唔好俾嘢食或飲，可能吞嚥困難。','無力嗰邊手腳要承托好，防受傷。']}),
    trauma:k=>({S:{gcs:'頭痛、迷糊',arrest:'冇反應',fall:'背痛',minor:'手肘擦傷'}[k],A:'冇藥物敏感',M:'冇',P:'冇',L:'午餐',E:{gcs:'電單車撞車',arrest:'被車撞',fall:'由 8 米高墮下',minor:'單車跌倒'}[k],props:k==='minor'?['helmet']:[],
      safe:['交通意外現場：注意來往車輛，警察封路先入。','按創傷分流準則決定送邊間醫院。']}),
    lvad:k=>({S:k==='arrest'?'冇反應':'頭暈',A:'冇藥物敏感',M:'薄血藥（Warfarin）',P:'心臟衰竭，已裝 LVAD',L:'午餐',E:k==='arrest'?'太太發現佢暈低':'頭暈、乏力半日',props:['lvadbag'],
      safe:['控制器同電線唔可以分開，唔好牽拉扭轉。','後備電池同控制器一齊帶上車。','剪衫時小心電線，唔好整濕部機。']})
  };
  const get=sc=>{ const f=D[sc.id]; return f?f(sc.varK):null; };
  // 每一步嘅注意事項：先睇用咩工具，再睇步驟
  const TT={asa:'用藥前核對 5R（啱病人、藥物、劑量、途徑、時間），問清楚有冇敏感同 SAPHBUS。',ntg:'噴之前量 BP；病人坐低或者躺低，噴喺脷底唔好吞；每劑相隔 5 分鐘，最多 3 噴。',
    salb:'用儲霧器：搖勻、噴一下、慢慢深吸 4–6 啖；之後再評估氣促同喘鳴。',ipra:'有青光眼病歷要閉眼、用紗布遮眼；懷孕、< 12 歲禁用。',d10:'俾糖水前確認病人清醒、可以安全吞嚥；一口一口慢慢飲。',
    ivset:'IV 前核對鹽水／糖水有效期同清澈度；接駁 3-way，留意有冇外滲。',ns:'Full Rate 期間密切留意氣促、肺音，防肺積水；按收縮壓調速度。',thia:'Thiamine 經 3-way 慢慢落藥，之後沖管。',
    gluc:'Glucagon 要先溶解；IM 打大腿外側；IMI 禁忌就改 SC；生效要 10–15 分鐘。',nalox:'Naloxone 作用可能短過麻醉藥；病人可能突然醒、激動或者嘔吐，預備抽痰。',charc:'俾之前確認清醒、可以吞嚥、2 小時內，並經 HKPIC 醫生批准；記錄飲用份量。',
    mida:'Midazolam 會抑制呼吸，打完要預備 BVM；記錄抽搐開始同用藥時間。',jext:'Jext 打大腿前外側，可以隔褲打，停留 10 秒；記錄時間，用過嘅交俾醫院。',piri:'Piriton 會令人眼瞓；4 小時內用過抗組織胺唔好再俾。',
    trama:'打完 Tramadol 留意反胃、頭暈、低血壓；預備嘔吐袋。',txa:'TXA 每分鐘 100 mg 慢慢推，太快會低血壓；記錄開始時間。',olz:'要有足夠警員協助先注射；用藥後持續監察呼吸、血壓同體溫。',
    penth:'病人自己握住吸，唔好留佢無人看管；車上開窗通風；只得一劑。',adr:'Adrenaline 每 3–5 分鐘一次，推完用 NS Full Rate 沖管 10 秒；記錄每劑時間。',amio:'Amiodarone 推完要沖管；記錄電擊同用藥次數。',
    io:'IO 位置：脛骨近端內側；確認嗰隻腳冇骨折、冇感染先鑽。',opa:'OPA 尺寸由口角量到耳珠；有嘔吐反射就改用 NPA。',bvm:'BVM 每次擠到胸口剛好起伏就夠，太大力會令胃脹、嘔吐。',suction:'每次抽痰唔好超過 10–15 秒，抽完即刻俾氧。',
    nrm:'NRM 開 15 L，等儲氣袋脹滿先戴上。',ven:'文氏面罩由 FiO₂ 0.24 開始，按 SpO₂ 每 1–2 分鐘調整。',nc:'鼻插喉 1–4 L；SpO₂ 仍然低就轉面罩。',
    lt:'插喉唔好停 CPR 超過 10 秒；插完聽兩邊肺同胃，接 Filter。',lma:'插 LMA 喺電擊後 2 分鐘 CPR 空檔做，唔好超過 30 秒。',combi:'每次換管都要聽肺同胃確認位置。',
    aed:'電擊前大聲講「所有人離開」，確認冇人掂病人、氧氣喉唔喺胸口附近。',accm:'安裝 ACCM 唔好停 CPR 超過 10 秒，裝好檢查按壓位置。',ecg:'貼電極前講原因、取得同意，注意私隱；傳輸失敗唔好耽誤送院。',
    tq:'止血帶紮好要記時間，唔好用衫褲蓋住；交接時講清楚位置同時間。',hd:'止血敷料要按入傷口接觸出血點，按壓最少 3 分鐘；唔好用喺眼球、胸腔、腹腔大傷口。',
    splint:'上夾板前後都要檢查遠端脈搏、感覺同活動（大 check）。',sager:'牽引前後檢查遠端循環神經；牽引力唔好超過上限。',tpod:'唔好由盆骨上方滾動病人；記錄上 T-POD 時間。',
    collar:'戴頸套前量好尺寸，全程保持頭部中線位置。',board:'上板用多人同步，聽一個人口令。',burn:'Burnkit 唔好覆蓋多過 15%，唔好弄穿水泡。',water:'冷水沖唔好超過 10 分鐘，防體溫過低。',
    foil:'由頭包到腳但唔好阻礙呼吸；搬動要輕。',wrap:'包埋個頭，因為頭部散熱最多。',hotpack:'Hot Pack 唔可以直接貼皮膚，每 10–20 分鐘換。',phone:'通報時講清楚：救護車編號、病人資料、預計到達時間、聯絡電話。',ppe:'先保護自己：手套、保護衣、N95。'};
  const KT={RSE:'戴手套等 PPE；留意交通、火、電、化學品、針筒等危險；危險未排除唔好埋位。',LOC:'AVPU 次序：先觀察 → 大聲叫 → 擠壓斜方肌；記低時間，途中重複評估。',
    D:'有 MOI 或頸背痛就先用頭鎖，唔好叫病人郁頸試痛；之後用 NEXUS 評估。',CAB:'摸脈搏同睇呼吸唔好超過 10 秒；呼吸太慢太淺或者發紺就要即刻 BVM。',
    O2:'SpO₂ 開機半分鐘後先準；手指凍、一氧化碳中毒、貧血、低血壓時讀數唔可信。',RBS:'約 30 秒由頭到腳；要展露傷處，但注意私隱同保暖。',SKIN:'同時睇顏色、摸溫度同濕度；蒼白濕冷要諗休克。',
    DEC:'穩定 = 冇生命危險；行到 Protocol 一律屬不穩定。有藥幫到佢就喺現場先俾藥再上車；現場冇藥幫到就立即上車 (LOAD & GO)。途中 Q5 量維生指數。',HX:'用 SAMPLE／OPQRST 問；藥物敏感一定要問；藥袋、藥樽帶埋上車。',VS:'不穩定 Q5、穩定 Q15；數值同臨床表現唔夾就再量或者手動確認。',
    HS:"篤手指前用酒精棉清潔並等乾，第一滴血抹走；讀數 ≦ 4 或 > 20 跟 Glycemia Protocol。",TX:'用任何藥物前核對 5R，問清楚藥物敏感；用藥後再評估效果同副作用。',
    LG:'上車前確認氣道、出血已處理；綁好安全帶、固定器材；同家屬講清楚送邊間醫院。',RE:'途中重複 LOC → CAB → 維生指數；病情有變就重新跟規程處理，並記錄時間。',
    CPR:'按壓深度 5–6 cm、每分鐘 100–120 下，每次完全回彈；每 2 分鐘換人按。',AED:'電擊前大聲講「所有人離開」，確認冇人掂病人。',AW:'插高級氣道唔好停 CPR 超過 10 秒；插完確認位置，用 Filter。',
    BLEED:'戴手套直接加壓係第一步；危及生命出血要先處理，再做其他評估。',SPL:'固定前後都要檢查遠端循環、感覺、活動。',HOSP:'分流：心臟驟停送最就近醫院；符合創傷準則送創傷中心。',CALL:'通報時講清楚：救護車編號、病人資料、預計到達時間、聯絡電話。'};
  function tip(c,sc){ if(!c||c.k==='MIST') return ''; if(c.tip) return c.tip; const ans=(c.q&&c.q.o[0])||'';
    if(/^(唔可以|唔使|未可以|唔需要|暫時唔可以)/.test(ans)&&['TX','AW','BLEED','SPL'].includes(c.k)) return '禁忌或者唔符合就唔好用，喺紀錄同交接講清楚原因；改用其他處理方法。';
    const g=SIMTOOLS.need(c,sc.id); for(const grp of g) for(const id of grp) if(TT[id]&&!['spo2','bp','gluco','torch'].includes(id)) return TT[id];
    return KT[c.k]||''; }
  const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  function card(sc){ const d=get(sc)||{}; const rse=(sc.steps.find(s=>s.k==='RSE')||{}).find||'';
    const why=[...new Set(sc.base.vars.flatMap(v=>{ try{ const m=sc.base.make(v); return [...m.steps,...m.hosp].filter(s=>['TX','AW','BLEED','SPL','CPR','AED'].includes(s.k)&&s.q&&s.q.why).map(s=>s.q.why); }catch(e){ return []; } }))].slice(0,8);
    return '<h3>📋 '+esc(sc.title)+'（'+esc(sc.en||'')+'）</h3>'+
      '<p>🚑 '+esc(sc.call)+'</p><p>🧍 病人：'+esc(sc.who)+'</p>'+(rse?'<p>📍 現場：'+esc(rse)+'</p>':'')+
      (d.S?'<h4>🗒️ SAMPLE 病史</h4><ul><li><b>S 徵狀</b>：'+esc(d.S)+'</li><li><b>A 敏感</b>：'+esc(d.A)+'</li><li><b>M 藥物</b>：'+esc(d.M)+'</li><li><b>P 病歷</b>：'+esc(d.P)+'</li><li><b>L 最後進食</b>：'+esc(d.L)+'</li><li><b>E 經過</b>：'+esc(d.E)+'</li></ul>':'')+
      (d.safe?'<h4>⚠️ 行動注意事項</h4><ul>'+d.safe.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'')+
      (why.length?'<h4>📘 規程重點（ems.homes）</h4><ul>'+why.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'')+
      '<p style="color:#8b97a6;font-size:12px">底部 🧰 工具列：入門模式隨時試用；專業模式答完題要揀啱器材先可以繼續，揀錯或者用錯時間會扣分。評估工具（血氧機、血壓計、血糖機、電筒、聽筒、體溫計）隨時用都唔扣分。</p>'; }
  return {get,tip,card};
})();

/* ---------- 🩺 現場模擬：跟足救護規程（資料來源：ems.homes）嘅流程骨幹 ----------
   RSE → LOC → D → CAB → O2 → RBS → SKIN → DECISION → 病史 → 維生指數 → 處理（5R）→ LOAD & GO → 途中重新評估 → MIST 交接
   兩個難度：入門（市民：有提示、淺白題目）、專業（同事：自己揀下一步、跟規程劑量同適用症／禁忌症）。 */
const SIM=(()=>{
  const CH={RSE:['RSE','現場安全'],LOC:['LOC','清醒程度'],D:['D','脊椎'],CAB:['CAB','循環 氣道 呼吸'],O2:['O₂','氧氣'],RBS:['RBS','快速檢查'],SKIN:['SKIN','皮膚'],DEC:['DECISION','決定'],HX:['Hx','病史'],VS:['VS','維生指數'],HS:["H'stix",'血糖'],TX:['5R','處理／用藥'],LG:['LOAD & GO','上車送院'],RE:['RE','途中評估'],MIST:['MIST','交接'],CPR:['CPR','心肺復甦'],AED:['AED','去顫器'],AW:['氣道','高級氣道'],BLEED:['止血','控制出血'],SPL:['固定','固定／制動'],HOSP:['分流','揀醫院'],CALL:['通知','通知醫院']};
  const AVPU=['A','V','P','U'];
  // 入門題目（通用）：淺白，3 個選項
  const EZ={
    RSE:{q:'救護員到場，第一件事係？',o:['確保現場安全，留意發生咩事','即刻幫病人打針','先影相'],a:0,why:'RSE：先確保自己同其他人安全，留意致傷過程 (MOI)，再接觸病人。'},
    LOC:{q:'「LOC」係檢查病人嘅咩？',o:['清醒程度（AVPU）','血糖','體溫'],a:0,why:'LOC = Level of Consciousness，用 AVPU：A 清醒、V 對說話有反應、P 對痛楚有反應、U 冇反應。'},
    D:{q:'流程入面嘅「D」係檢查咩？',o:['脊椎（頸、背有冇受傷）','藥物','醫生'],a:0,why:'問有冇跌倒、撞傷頭頸、頸痛；懷疑脊椎受傷就用頭鎖固定頭部。'},
    CAB:{q:'CAB 嘅次序係？',o:['循環 → 氣道 → 呼吸','氣道 → 呼吸 → 循環','呼吸 → 循環 → 氣道'],a:0,why:'C 循環（摸脈搏）、A 氣道、B 呼吸。冇脈搏就即刻 CPR。'},
    O2:{q:'量血液含氧量用咩儀器？',o:['血氧機（SpO₂，夾手指）','體溫計','血壓計'],a:0,why:'SpO₂ 夾手指，開機半分鐘後數據較準；按讀數決定俾唔俾氧、用咩面罩。'},
    RBS:{q:'快速檢查 (RBS) 大約用幾耐？',o:['約 30 秒','約 10 分鐘','約 1 小時'],a:0,why:'頭、頸、胸、腹、髖、背、下肢、上肢快速檢查，展露傷處盡快處理。'},
    SKIN:{q:'皮膚蒼白、濕冷可能代表？',o:['血液循環唔好（休克徵狀）','好健康','曬傷'],a:0,why:'休克徵狀：Pale、cool、clammy（蒼白、冷、濕）。'},
    DEC:{q:'行到 Protocol 嘅病人屬於？',o:['不穩定：有藥幫到就喺現場先俾藥，冇藥就立即上車','穩定：喺現場慢慢檢查一個鐘','穩定：叫佢自己去醫院'],a:0,why:'穩定 = 冇生命危險；行到 Protocol 一律屬不穩定。'},
    HX:{q:'問病史可以幫救護員？',o:['了解發生咩事、病人背景同用藥','冇用','只係傾偈'],a:0,why:'主要不適、經過、過去病歷、藥物、過敏，都會影響處理同用藥。'},
    VS:{q:'維生指數包括？',o:['血壓、脈搏、呼吸、血氧','身高、體重','血型'],a:0,why:'不穩定病人每 5 分鐘量一次，穩定病人每 15 分鐘。'},
    HS:{q:"H'stix 係量咩？",o:['血糖','血壓','體溫'],a:0,why:"H'stix 即係手指篤血驗血糖，單位 mmol/L。"},
    LG:{q:'「LOAD & GO」係？',o:['上車送院，途中繼續觀察','留喺現場等','返救護站'],a:0,why:'處理好威脅生命嘅問題後就上車送院，途中繼續監察。'},
    RE:{q:'送院途中救護員要做咩？',o:['重新評估病人、量維生指數','休息','唔使理病人'],a:0,why:'途中密切觀察，病情有變就跟規程再處理。'} };
  function skinEZ(f){ f=f||'';
    if(/針孔/.test(f)) return {q:'皮膚發紺，仲有好多針孔同瘀痕，可能代表？',o:['缺氧，加上經常注射藥物','曬傷','好健康'],a:0,why:'發紺（嘴唇、指甲發藍）代表缺氧；多個新舊針孔提示經常注射藥物，常見於手臂、大腿內側。'};
    if(/發紺/.test(f)) return {q:'嘴唇、指甲發紺（發藍）代表？',o:['缺氧','好健康','曬傷'],a:0,why:'發紺 (Cyanosis) 代表血液含氧量低，要即刻處理氣道、呼吸同氧氣。'};
    if(/水泡|燒|燙/.test(f)) return {q:'皮膚紅、起水泡，應該點處理？',o:['用清水沖洗降溫，再蓋燒傷敷料','刺穿水泡','塗牙膏'],a:0,why:'燒燙傷要盡快用清涼水沖洗，之後用燒傷敷料覆蓋，唔好刺穿水泡。'};
    if(/風疹|潮紅|身熱|熱/.test(f)) return {q:'皮膚潮紅、熱，可能代表？',o:['發燒、中暑或者過敏反應','休克','好健康'],a:0,why:'潮紅、熱：可能係發燒、中暑；加埋風疹塊就要諗過敏反應。'};
    if(/乾/.test(f)) return {q:'皮膚乾、口乾可能代表？',o:['脫水','好健康','發燒退咗'],a:0,why:'皮膚同口腔乾係脫水嘅徵狀。'};
    if(/蒼白|濕冷|冷汗|冰冷/.test(f)) return EZ.SKIN;
    return {q:'SKIN 皮膚檢查要睇咩？',o:['顏色、溫度、濕度','髮型','身高'],a:0,why:'睇顏色（蒼白、潮紅、發紺）、摸溫度同濕度。'}; }
  const SC=SIMLV;
  /* ===== 狀態 ===== */
  const st={on:false};
  const $s=id=>document.getElementById(id);
  const css=document.createElement('style'); css.textContent=`
  #simMon,#simBar,#simBox{display:none;position:fixed;z-index:30;font-family:inherit;color:#e8edf3}
  body.simScene #simMon,body.simScene #simBar,body.simScene #simBox{display:block}
  body.simScene .btns,body.simScene #mini,body.simScene .top .card,body.simScene #cap,body.simScene #pcKeys,body.simScene #rHud,body.simScene #stabBox,body.simScene #radio,body.simScene #toast{display:none!important}
  #simMon{left:10px;top:calc(10px + env(safe-area-inset-top));width:min(300px,46vw);box-sizing:border-box;background:#05080ce8;border:1px solid #2a3442;border-radius:8px;padding:6px 8px;box-shadow:0 6px 20px #0008;overflow:hidden}
  #simMon canvas{display:block;width:100%;height:46px;background:#020403;border-radius:4px}
  #simMon .g{display:grid;grid-template-columns:repeat(auto-fill,minmax(58px,1fr));gap:2px 6px;margin-top:4px}
  #simMon .g div{min-width:0;overflow:hidden;font-size:10px;color:#8b97a6;line-height:1.1;white-space:nowrap}#simMon .g b{display:block;font-size:clamp(12px,3.6vw,17px);font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:clip}
  #simMon .hr b{color:#3ddc6a}#simMon .bp b{color:#ff6b6b}#simMon .sp b{color:#5ec8ff}#simMon .rr b{color:#ffd166}#simMon .lc b{color:#e8edf3}#simMon .bs b{color:#c792ea}#simMon .pn b{color:#ff9f43}#simMon .tm b{color:#fff}
  #simBar{left:10px;top:150px;width:96px;overflow-y:auto;overflow-x:hidden;display:none;scrollbar-width:none}#simBar::-webkit-scrollbar{display:none}
  body.simScene #simBar{display:flex;flex-direction:column;gap:4px}
  @media (max-width:560px){ #simBar{width:78px} #simBar button{font-size:11px!important;padding:3px 5px!important} #simMon{width:min(250px,64vw);padding:4px 6px} #simMon canvas{height:28px} #simMon .g{grid-template-columns:repeat(4,1fr);gap:1px 4px} #simMon .g div{font-size:9px} #simMon .g b{font-size:12px}
    #simBox{max-height:40vh!important;padding:8px 10px!important} #simBox .find{font-size:13px!important;padding:5px 7px!important} #simBox .q{font-size:14px!important} #simBox .opts{gap:4px!important} #simBox .opts button{font-size:13px!important;padding:6px 8px!important} #simBox .why{font-size:12px!important} #simGo{font-size:16px!important;padding:10px 22px!important} }
  #simBar button{flex:none;text-align:left;font:inherit;font-size:12px;font-weight:800;color:#cfd6df;background:#0b0f16d9;border:1px solid #33404f;border-radius:5px;padding:4px 7px;cursor:pointer}
  #simBar button small{display:block;font-size:9px;font-weight:600;color:#8b97a6}
  #simBar button.done{background:#123a22;border-color:#2f9e5b;color:#bff5d0}#simBar button.next{border-color:#ffcf5a;box-shadow:0 0 0 2px #ffcf5a55;color:#fff;animation:simP 1s infinite alternate}@keyframes simP{to{box-shadow:0 0 0 5px #ffcf5a22}}
  #simBar button.bad{animation:simS .3s}@keyframes simS{25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
  #simBox{left:0;right:0;margin:0 auto;bottom:calc(var(--simTB,96px) + 64px);width:min(620px,96vw);box-sizing:border-box;max-height:min(56vh,440px);overflow:auto;background:#0b0f16f0;border:1px solid #2f3b4a;border-left:4px solid #ffcf5a;border-radius:8px;padding:10px 12px;box-shadow:0 8px 28px #000a}
  #simBox h3{margin:0 0 4px;font-size:15px;color:#ffcf5a}#simBox .act{font-size:12px;color:#9fb0c3;margin:0 0 6px}#simBox .find{font-size:14px;line-height:1.45;background:#ffffff0d;border-radius:6px;padding:6px 8px;margin:0 0 8px}
  #simBox .q{font-size:15px;font-weight:800;margin:6px 0}#simBox .hint{font-size:12px;color:#ffd98a;margin:0 0 6px}
  #simBox .opts{display:grid;gap:6px}#simBox .opts button{font:inherit;font-size:14px;text-align:left;color:#eef2f7;background:#ffffff0f;border:1px solid #ffffff2a;border-radius:6px;padding:8px 10px;cursor:pointer}
  #simBox .opts button i{font-style:normal;display:inline-block;min-width:18px;margin-right:6px;padding:0 4px;border:1px solid #ffffff55;border-radius:3px;font-size:11px;text-align:center;color:#ffcf5a}
  #simBox .opts button.ok{background:#16a34a33;border-color:#4ade80}#simBox .opts button.no{background:#dc262633;border-color:#f87171}#simBox .opts button:disabled{cursor:default}
  #simBox .why{font-size:13px;line-height:1.45;color:#cfd6df;margin:8px 0 0;padding:6px 8px;border-radius:6px;background:#1d2a3a}
  #simGo{position:fixed;right:calc(14px + env(safe-area-inset-right));bottom:calc(var(--simTB,96px) + 10px);z-index:70;font:inherit;font-size:18px;font-weight:900;color:#1a1200;background:#ffcf5a;border:0;border-radius:30px;padding:12px 28px;cursor:pointer;box-shadow:0 6px 20px #000a;animation:simGo .8s ease-in-out infinite alternate}@keyframes simGo{from{transform:scale(1);box-shadow:0 0 0 0 #ffcf5aaa,0 6px 20px #000a}to{transform:scale(1.07);box-shadow:0 0 0 10px #ffcf5a00,0 6px 20px #000a}}
  #simTools{display:none;position:fixed;left:0;right:0;bottom:0;z-index:40;background:#070b11f2;border-top:1px solid #2f3b4a;padding:4px 6px calc(4px + env(safe-area-inset-bottom));font-family:inherit;color:#e8edf3}
  body.simScene #simTools{display:block}
  #simTools .tabs{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;margin-bottom:4px}#simTools .tabs::-webkit-scrollbar,#simTools .items::-webkit-scrollbar{display:none}
  #simTools .tabs button{flex:none;font:inherit;font-size:12px;font-weight:800;color:#9fb0c3;background:transparent;border:1px solid #2f3b4a;border-radius:14px;padding:3px 10px;cursor:pointer}
  #simTools .tabs button.on{color:#1a1200;background:#ffcf5a;border-color:#ffcf5a}
  body.simScene.simHide #simBox{display:none!important}
  #simTools .tabs .hb{color:#1a1200;background:#9fe8ff;border-color:#9fe8ff}body.simHide #simTools .tabs .hb{background:linear-gradient(100deg,#9fe8ff 30%,#ffffff 50%,#9fe8ff 70%);background-size:250% 100%;animation:simShine 1.8s linear infinite;box-shadow:0 0 10px #9fe8ffaa}body.simHide #simTools .tabs .hb.new{background:linear-gradient(100deg,#ffcf5a 30%,#fff7d6 50%,#ffcf5a 70%);background-size:250% 100%;animation:simShine .9s linear infinite;box-shadow:0 0 14px #ffcf5acc}@keyframes simShine{from{background-position:120% 0}to{background-position:-120% 0}}#simTools .tabs .hb.new{animation:simP 0.8s infinite alternate;background:#ffcf5a;border-color:#ffcf5a}
  #simTools .tabs .rv{color:#cfd6df}
  body.simScene #bAEB{display:none!important}
  body.simScene #bMenu{position:fixed!important;top:calc(10px + env(safe-area-inset-top))!important;right:calc(12px + env(safe-area-inset-right))!important;left:auto!important;bottom:auto!important;z-index:45}
  #simTools .tabs .card{color:#bde0ff;border-color:#3b82f6;background:#10233d}
  #simTools .items{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
  #simTools .items button{flex:none;width:76px;min-height:52px;font:inherit;font-size:11px;line-height:1.15;color:#e8edf3;background:#ffffff0d;border:1px solid #ffffff22;border-radius:8px;padding:4px 3px;cursor:pointer}
  #simTools .items button b{display:block;font-size:20px;line-height:1.1}
  #simTools .items button.used{border-color:#2f9e5b;background:#123a22}
  #simTools .items button.bad{animation:simS .3s;border-color:#f87171}
  #simTools.want{box-shadow:0 -4px 18px #ffcf5a55;border-top-color:#ffcf5a}
  #simBox .tneed{font-size:13px;color:#ffd98a;margin:8px 0 0;padding:6px 8px;border:1px dashed #ffcf5a88;border-radius:6px}
  #simBox .tip{font-size:12.5px;line-height:1.45;color:#ffe2a8;margin:6px 0 0;padding:6px 8px;border-radius:6px;background:#3a2a0a}
  #simCard{display:none;position:fixed;inset:0;z-index:80;background:#000a;align-items:center;justify-content:center;font-family:inherit}
  #simCard.on{display:flex}#simCard .in{width:min(560px,94vw);max-height:84vh;overflow:auto;background:#0b0f16;color:#e8edf3;border:1px solid #2f3b4a;border-radius:12px;padding:14px 16px;box-shadow:0 10px 40px #000}
  #simCard h3{margin:0 0 6px;color:#ffcf5a;font-size:17px}#simCard h4{margin:12px 0 4px;color:#bde0ff;font-size:14px}#simCard p,#simCard li{font-size:13.5px;line-height:1.5;color:#d5dde6}#simCard ul{margin:4px 0;padding-left:18px}
  #simCard .x{float:right;font:inherit;font-size:14px;font-weight:800;border:0;border-radius:16px;padding:4px 12px;background:#ffcf5a;color:#1a1200;cursor:pointer}
  #simBox .mist{display:grid;gap:6px}#simBox .mist button b{color:#ffcf5a;margin-right:6px}
  #simBox .res{font-size:14px;line-height:1.5}#simBox .res .gr{font-size:34px;font-weight:900}#simBox .res ul{margin:6px 0;padding-left:18px;font-size:13px;color:#cfd6df}
  @media (min-width:900px){ #simBox{left:auto;right:14px;margin:0;width:min(470px,40vw);bottom:calc(var(--simTB,96px) + 70px);max-height:calc(100vh - var(--simTB,96px) - 130px)} }
  @media (max-height:520px) and (orientation:landscape){ #simBox{left:auto!important;right:8px!important;margin:0!important;width:min(400px,46vw)!important;bottom:calc(var(--simTB,80px) + 66px)!important;max-height:calc(100vh - var(--simTB,80px) - 66px - 50px)!important}
    #simMon{width:min(230px,30vw)!important;padding:4px 6px!important} #simMon canvas{height:24px!important} #simMon .g{grid-template-columns:repeat(4,1fr)!important;gap:1px 4px!important} #simMon .g div{font-size:9px!important} #simMon .g b{font-size:12px!important}
    #simTools .items button{min-height:40px;width:68px;font-size:10px} #simTools .items button b{font-size:16px} #simTools .tabs button{font-size:11px;padding:2px 8px} #simBar button{font-size:11px!important;padding:3px 5px!important} #simBar{width:78px} }
  .simSeg{display:flex;gap:6px;margin:6px 0 10px}.simSeg button{flex:1;font:inherit;font-size:13px;font-weight:800;padding:8px;border-radius:10px;border:2px solid #e3e8ee;background:#fff;color:#334}.simSeg button.on{border-color:#e85d04;background:#fff3e8}.simSeg small{display:block;font-weight:600;font-size:11px;color:#778}
  .simCase{display:flex;gap:10px;align-items:center;width:100%;text-align:left;font:inherit;padding:10px 12px;margin:0 0 8px;border-radius:12px;border:2px solid #e3e8ee;background:#fff;cursor:pointer}
  .simCat{margin:12px 0 6px;font-size:14px;color:#334}.simCase .ic{font-size:26px}.simCase b{display:block;font-size:15px}.simCase span{font-size:12px;color:#667}.simCase em{margin-left:auto;font-style:normal;font-weight:900;font-size:13px;color:#e85d04}`; document.head.append(css);
  const mon=document.createElement('div'); mon.id='simMon'; mon.innerHTML='<canvas id="simEcg" width="300" height="46"></canvas><div class="g"><div class="hr">HR<b id="smHr">--</b></div><div class="bp">BP<b id="smBp">--</b></div><div class="sp">SpO₂<b id="smSp">--</b></div><div class="rr">RR<b id="smRr">--</b></div><div class="lc">LOC<b id="smLc">--</b></div><div class="bs">H\'stix<b id="smBs">--</b></div><div class="pn">痛楚<b id="smPn">--</b></div><div class="tm">時間<b id="smTm">0:00</b></div></div>';
  const bar=document.createElement('div'); bar.id='simBar'; const box=document.createElement('div'); box.id='simBox'; document.body.append(mon,bar,box);
  const GO=document.createElement('button'); GO.id='simGo'; GO.style.display='none'; document.body.append(GO);
  function showGo(t){ GO.textContent=t; GO.style.display='block'; GO.onclick=()=>{ hideGo(); next(); }; }
  function hideGo(){ GO.style.display='none'; }
  /* ----- 🧰 工具列（底部）＋ 📋 個案卡 ----- */
  const TB=document.createElement('div'); TB.id='simTools'; TB.innerHTML='<div class="tabs"></div><div class="items"></div>'; document.body.append(TB);
  const CARD=document.createElement('div'); CARD.id='simCard'; CARD.innerHTML='<div class="in"></div>'; document.body.append(CARD); CARD.onclick=e=>{ if(e.target===CARD||e.target.classList.contains('x')) CARD.classList.remove('on'); };
  let tCat='assess';
  function renderTools(){ const tabs=TB.querySelector('.tabs'), it=TB.querySelector('.items'); tabs.innerHTML='';
    const hb=document.createElement('button'); hb.className='hb'+(st.newQ&&document.body.classList.contains('simHide')?' new':''); hb.textContent=document.body.classList.contains('simHide')?'📝 顯示題目'+(st.newQ?' •':''):'📝 收埋題目'; hb.onclick=toggleBox; tabs.append(hb);
    const rv=document.createElement('button'); rv.className='rv'; rv.textContent='🎯 回正'; rv.title='重設視角（拖拉旋轉、Shift／右鍵或雙指拖動平移、滾輪／雙指縮放）'; rv.onclick=()=>SIMAN.resetView(); tabs.append(rv);
    const cb=document.createElement('button'); cb.className='card'; cb.textContent='📋 個案卡'; cb.onclick=openCard; tabs.append(cb);
    SIMTOOLS.CAT.forEach(([k,n])=>{ const b=document.createElement('button'); b.textContent=n; if(k===tCat) b.className='on'; b.onclick=()=>{ tCat=k; renderTools(); }; tabs.append(b); });
    it.innerHTML=''; Object.entries(SIMTOOLS.T).filter(([,t])=>t[2]===tCat).forEach(([id,t])=>{ const b=document.createElement('button'); b.innerHTML='<b>'+t[0]+'</b>'+esc(t[1]); b.dataset.id=id; if(st.used&&st.used.has(id)) b.className='used'; b.onclick=()=>useTool(id,b); it.append(b); });
    requestAnimationFrame(()=>{ document.documentElement.style.setProperty('--simTB',(TB.offsetHeight||96)+'px'); if(st.on) layout(); }); }
  function toggleBox(){ document.body.classList.toggle('simHide'); if(!document.body.classList.contains('simHide')) st.newQ=0; renderTools(); }
  addEventListener('keydown',e=>{ if(!st.on||!document.body.classList.contains('simScene')) return; if(e.key==='h'||e.key==='H'){ toggleBox(); } });
  function markNew(){ if(document.body.classList.contains('simHide')){ st.newQ=1; renderTools(); } }
  function toolMsg(t){ let m=box.querySelector('.tmsg'); if(!m){ m=document.createElement('p'); m.className='tneed tmsg'; box.append(m); } m.textContent=t; m.scrollIntoView&&m.scrollIntoView({block:'nearest'}); }
  const tName=id=>SIMTOOLS.T[id][1];
  function toolStatus(extra){ const el=box.querySelector('.treq'); if(!el) return; const left=st.tneed.length, done=st.tN-left;
    el.innerHTML='🧰 喺底部工具列揀要用嘅器材／藥物：已用 '+done+'／'+st.tN+(st.terr>=2&&left?'<br>💡 提示：'+st.tneed.map(g=>g.map(tName).join(' 或 ')).map(esc).join('、'):'')+(extra?'<br>'+esc(extra):''); }
  function toolDone(){ st.state='fb'; const p=Math.max(0,5-st.terr*2); st.score+=p; if(st.terr) st.log.push(CH[cur().k][0]+' 揀錯器材 '+st.terr+' 次'); TB.classList.remove('want');
    const el=box.querySelector('.treq'); if(el) el.innerHTML='✅ 器材用齊'+(st.terr?'（揀錯 '+st.terr+' 次，扣 '+(5-p)+' 分）':'')+'。'; setTimeout(()=>{ if(st.on) SIMAN.apply(); },1300); showGo('繼續 ▶'); }
  function useTool(id,btn){ if(!st.on||!document.body.classList.contains('simScene')||st.phase==='trans') return; const t=SIMTOOLS.T[id], kind=t[3], name=t[1];
    const rd=(kind==='a'||id==='ecg')?SIMTOOLS.reading(id,st.sc,st.v):'';
    if(rd){ if(id==='spo2') st.known.spo2=1; if(id==='bp'&&st.sc.id!=='lvad') st.known.sbp=1; if(id==='gluco') st.known.rbs=1; if(id==='ecg') st.known.hr=1; }
    if(st.phase==='scene') SIMAN.useTool(id,rd||name); st.t+=kind==='a'?10:20;
    const persist=kind==='d', already=persist&&st.used.has(id); if(persist) st.used.add(id);
    const bad=()=>{ if(btn){ btn.classList.remove('bad'); void btn.offsetWidth; btn.classList.add('bad'); } vib([40,40]); };
    if(!st.diff){ toolMsg('🧰 '+name+(rd?'：'+rd:'：已使用')); renderTools(); return; }
    if(st.state==='tool'){ const i=st.tneed.findIndex(g=>g.includes(id));
      if(i>=0){ st.tneed.splice(i,1); toolStatus(rd?name+'：'+rd:''); if(!st.tneed.length) toolDone(); }
      else if(kind==='a'||already) toolStatus(rd?name+'：'+rd:'');
      else { st.terr++; bad(); toolStatus('❌「'+name+'」而家唔啱用。'); } }
    else if(kind!=='a'&&!already){ st.score-=2; st.log.push('喺唔需要嘅時候用咗「'+name+'」'); bad(); toolMsg('⚠️ 而家唔係用「'+name+'」嘅時候（扣 2 分）。先答題，答完先揀器材。'); }
    else toolMsg('🧰 '+name+(rd?'：'+rd:'')); renderTools(); }
  function openCard(){ if(!st.on) return; CARD.querySelector('.in').innerHTML='<button class="x">關閉 ✕</button>'+SIMNOTES.card(st.sc); CARD.classList.add('on'); }
  const shuffle=a=>{ const b=a.slice(); for(let i=b.length-1;i>0;i--){ const j=Math.random()*(i+1)|0; [b[i],b[j]]=[b[j],b[i]]; } return b; };
  const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  /* ----- 開始 ----- */
  function begin(base,diff,drive){ const vv=base.vars[Math.random()*base.vars.length|0], m=base.make(vv), sc=Object.assign({},base,m,{varLabel:vv.label,varK:vv.k,base});
    Object.assign(st,{used:new Set(),tneed:[],on:true,open:false,locHold:null,locShown:0,state:null,sc,diff,drive,phase:'scene',i:0,steps:sc.steps,v:Object.assign({},sc.v),d:Object.assign({},sc.v),known:{},t:0,score:0,max:0,orderErr:0,ansErr:0,log:[],chips:null,busy:false,jumped:false});
    S.simOn=true; S.simSceneDone=false; S.simHandDone=false; S.qDone=[true,true,true];
    SIMAN.setCase(sc);
    { const tips=[]; [...sc.steps,...(sc.hosp||[])].forEach(x=>{ if(x.k==='TX'&&x.q&&x.q.why&&tips.length<3) tips.push(x.q.why.split('。')[0]+'。'); });
      S.kase=Object.assign({},S.kase,{title:sc.title,call:sc.call,steps:['救護員完成現場處理，準備搬病人上車床','病人上車床，繼續監察生命表徵','推車床返救護車，準備送院'],tips:tips.length?tips:['跟足 RSE → LOC → D → CAB 龍骨流程。'],equip:null,quiz:[],triage:null}); }
    $('call').textContent='控制中心：'+S.kase.place+'，'+sc.call; hud('🩺 現場模擬：'+sc.title,(diff?'專業':'入門')+' · '+S.kase.place);
    if(!drive){ const L=S.kase.loc; const dx=L.stop[0]-L.patient[0], dz=L.stop[1]-L.patient[1]; Object.assign(S.car,{x:L.stop[0],z:L.stop[1],a:Math.atan2(dx,dz),v:0}); S.camYaw=S.car.a; S.leftDepot=true;
      amb.position.set(S.car.x,0.12,S.car.z); amb.rotation.y=S.car.a; cam.position.set(L.patient[0]+8,6,L.patient[1]+8); camLook.set(L.patient[0],1,L.patient[1]); arriveScene(); } }
  function end(){ hideGo(); document.body.classList.remove('simHide'); CARD.classList.remove('on'); TB.classList.remove('want'); SIMAN.clear(); st.on=false; st.open=false; st.locHold=null; S.simOn=false; document.body.classList.remove('simScene'); box.innerHTML=''; bar.innerHTML=''; }
  /* ----- 現場／醫院：由 sequence 叫 ----- */
  function atScene(){ if(st.phase!=='scene'||st.open) return; st.open=true; document.body.classList.add('simScene'); tCat='assess'; renderTools(); SIMAN.enter(); caption(null); renderBar(); pickPrompt(); }
  function atHosp(){ if(st.phase!=='trans'||st.open) return; st.phase='hosp'; st.steps=st.sc.hosp; st.i=0; st.chips=null; st.open=true; st.t0h=st.t; document.body.classList.add('simScene'); caption(null); renderTools(); renderBar(); pickPrompt(); }
  const cur=()=>st.steps[st.i];
  function chipKeys(){ const ks=[]; st.steps.forEach(s=>{ if(!ks.includes(s.k)) ks.push(s.k); }); return ks; }
  function layout(){ const m=$s('simMon').getBoundingClientRect(), b=box.getBoundingClientRect(), desk=innerWidth>=900; const top=m.bottom+8, tb=TB.offsetHeight||0, lim=desk||!b.height||b.left>bar.getBoundingClientRect().right+4?innerHeight-tb-12:b.top-8; bar.style.top=top+'px'; bar.style.maxHeight=Math.max(60,lim-top)+'px'; }
  addEventListener('resize',()=>{ if(st.on) layout(); });
  try{ const ro=new ResizeObserver(()=>{ if(st.on&&document.body.classList.contains('simScene')) layout(); }); ro.observe(box); ro.observe(mon); }catch(e){}
  function renderBar(){ const ks=chipKeys(); if(!st.chips) st.chips=store.get('simShuffle',false)&&st.phase==='scene'?shuffle(ks):ks; const c=cur(), doneK=new Set(st.steps.slice(0,st.i).map(s=>s.k));
    bar.innerHTML=''; st.chips.forEach(k=>{ const b=document.createElement('button'); b.innerHTML=CH[k][0]+'<small>'+CH[k][1]+'</small>'; const isDone=doneK.has(k)&&(!c||c.k!==k);
      if(isDone) b.className='done'; else if(!st.diff&&c&&c.k===k&&st.state==='pick') b.className='next'; b.onclick=()=>choose(k,b); bar.append(b); }); requestAnimationFrame(layout); }
  // 揀下一步（專業：要自己記流程；入門：有提示）
  function pickPrompt(){ st.state='pick'; const c=cur(); renderBar(); markNew(); if(!c){ return; }
    const ezH=!st.diff?'<p class="hint">提示：按流程，下一步係「'+CH[c.k][0]+' '+CH[c.k][1]+'」（左邊發光嗰粒）。</p>':'<p class="hint">按流程揀下一步（左邊嘅步驟）。</p>';
    box.innerHTML='<h3>'+(st.phase==='scene'?'🩺 現場處理':'🏥 送院途中／到院')+'</h3><p class="act">'+st.sc.who+' · '+st.sc.title+'</p>'+ezH; }
  function choose(k,btn){ if(st.state!=='pick') return; const c=cur(); if(!c) return;
    if(k!==c.k){ const done=st.steps.slice(0,st.i).some(s=>s.k===k); st.max+=0; if(!done){ st.orderErr++; st.score-=3; st.t+=20; } btn.classList.remove('bad'); void btn.offsetWidth; btn.classList.add('bad');
      box.querySelector('.hint')&&(box.querySelector('.hint').innerHTML='✖ 未到呢一步。'+(st.diff?'諗吓流程：RSE → LOC → D → CAB → O₂ → RBS → SKIN → DECISION……':'下一步係「'+CH[c.k][0]+'」。')); return; }
    st.score+=3; st.max+=3; showStep(); }
  // 文字講到嘅讀數（量度結果）即刻同步去監測器，避免文字同儀器唔夾
  function textVitals(f){ const r={}; let m; f=String(f||'').split('→')[0];
    if(m=f.match(/(?:橈動脈|頸動脈|股動脈|HR|脈搏)\s*(\d{2,3})/)) r.hr=+m[1];
    if(m=f.match(/(?:RR|呼吸)\s*(\d{1,2})\s*次?/)) r.rr=+m[1];
    if(m=f.match(/SpO₂\s*(?:顯示\s*)?(\d{2,3})\s*%/)) r.spo2=+m[1];
    if(m=f.match(/(?:BP|SBP)\s*(\d{2,3})(?:／(\d{2,3}))?/)){ r.sbp=+m[1]; if(m[2]) r.dbp=+m[2]; }
    if(m=f.match(/H'stix[：:\s]*([\d.]+)/)) r.rbs=+m[1];
    return r; }
  function showStep(){ const c=cur(); if(c&&c.k!=='MIST'){ const tv=textVitals(c.find); Object.assign(st.v,tv); Object.keys(tv).forEach(k=>{ if(k!=='dbp') st.known[k]=1; }); }
    st.state='q'; markNew(); st.t+=({RSE:20,LOC:10,D:15,CAB:30,O2:30,RBS:30,SKIN:10,DEC:5,HX:60,VS:60,HS:30,TX:45,LG:20,RE:60,MIST:60})[c.k]||20;
    if(!(c.k==='LOC'&&st.diff&&st.phase==='scene')) (c.reveal||[]).forEach(r=>st.known[r]=1); renderBar(); kneelAnim();
    if(c.k==='MIST'){ SIMAN.play(c,null,st.phase==='hosp'); return mistStep(c); }
    if(c.k==='LOC'&&st.diff&&st.phase==='scene') return locStep(c);
    const Q=(!st.diff&&(c.e||(c.k==='SKIN'?skinEZ(c.find):EZ[c.k])))||c.q; SIMAN.play(c,c.q,st.phase==='hosp'); let ord=shuffle(Q.o.map((x,i)=>i)); if(!st.diff&&ord.length>3) ord=shuffle([Q.a,...ord.filter(i=>i!==Q.a).slice(0,2)]);
    box.innerHTML='<h3>'+CH[c.k][0]+' · '+CH[c.k][1]+'</h3><p class="act">🧑‍⚕️ '+esc(c.act)+'</p><p class="find">'+esc(c.find)+'</p><p class="q">'+esc(Q.q)+'</p><div class="opts"></div>';
    const O=box.querySelector('.opts'); ord.forEach((oi,n)=>{ const b=document.createElement('button'); b.innerHTML='<i>'+(n+1)+'</i>'+esc(Q.o[oi]); b.dataset.i=oi; b.onclick=()=>answer(Q,oi,b); O.append(b); }); st.max+=10; }
  function answer(Q,oi,b){ if(st.state!=='q') return; st.state='fb'; const ok=oi===Q.a; const c=cur();
    box.querySelectorAll('.opts button').forEach(x=>{ x.disabled=true; if(+x.dataset.i===Q.a) x.classList.add('ok'); else if(x===b) x.classList.add('no'); });
    if(ok) st.score+=10; else { st.ansErr++; st.t+=30; st.log.push(CH[c.k][0]+'：'+Q.o[Q.a]); }
    if(c.set) Object.assign(st.v,c.set); if(c.set) Object.keys(c.set).forEach(k=>{ if(k in st.known||['spo2','pain','rbs','sbp','hr','avpu','gcs','rr'].includes(k)) {} });
    vib(ok?20:[40,40,40]); const w=document.createElement('div'); w.className='why'; w.innerHTML=(ok?'✅ 正確。':'❌ 正確答案：'+esc(Q.o[Q.a])+'。')+'<br>'+esc(Q.why); box.append(w);
    addTip(c);
    const need=st.diff?SIMTOOLS.need(c,st.sc.id).filter(g=>!g.some(id=>SIMTOOLS.T[id][3]==='d'&&st.used.has(id))):[];
    if(need.length){ st.state='tool'; st.tneed=need.map(g=>g.slice()); st.tN=need.length; st.terr=0; st.max+=5; const r=document.createElement('p'); r.className='tneed treq'; box.append(r); toolStatus(); TB.classList.add('want'); r.scrollIntoView&&r.scrollIntoView({block:'nearest'}); return; }
    SIMAN.apply(); showGo('繼續 ▶'); }
  function addTip(c){ const tp=SIMNOTES.tip(c,st.sc); if(!tp) return; const d=document.createElement('div'); d.className='tip'; d.innerHTML='⚠️ <b>注意事項</b>：'+esc(tp); box.append(d); }
  /* ----- 專業：LOC 互動（觀察 → 叫佢 → 擠壓斜方肌 → 判斷 AVPU） ----- */
  function locStep(c){ st.state='loc'; const a=['A','V','P','U'].indexOf(c.q.o[0][0]); const L={obs:0,voice:0,pain:0,order:[],log:[]}; st.locHold=a; SIMAN.play(c,c.q,false); SIMAN.focusOn('head');
    box.innerHTML='<h3>LOC · 清醒程度</h3><p class="act">🧑‍⚕️ 自己測試病人反應，再判斷 AVPU</p><div class="opts lact"></div><div class="lres"></div><p class="q" style="display:none">AVPU 評級係？</p><div class="opts lans" style="display:none"></div>';
    const O=box.querySelector('.lact'), R=box.querySelector('.lres'), Qp=box.querySelector('.q'), AN=box.querySelector('.lans');
    const log=t=>{ const p=document.createElement('p'); p.className='find'; p.textContent=t; R.append(p); };
    const acts=[['obs','👀 觀察','觀察病人'],['voice','🗣️ 叫佢','大聲叫病人'],['pain','✊ 擠壓斜方肌','痛楚刺激']];
    acts.forEach(([k,lab],n)=>{ const b=document.createElement('button'); b.innerHTML='<i>'+(n+1)+'</i>'+lab; b.onclick=()=>{ if(st.state!=='loc') return; L.order.push(k); L[k]++; st.t+=k==='obs'?5:k==='voice'?5:8;
      const r=SIMAN.react(k==='obs'?'observe':k==='voice'?'voice':'pain',a);
      if(k==='obs') log(r==='open'?'👀 病人眼係打開嘅，望住你。':'👀 病人合埋眼，冇自己郁。'+(st.v.rhythm==='noise'?'（全身抽搐中）':''));
      if(k==='voice') setTimeout(()=>log(r==='A'?'🗣️ 病人清醒對答。':r==='V'?'🗣️ 叫佢之後，病人打開眼、應咗一聲。':'🗣️ 大聲叫佢：冇反應。'),900);
      if(k==='pain'){ if(!L.voice) L.log.push('未叫就擠壓斜方肌'); else if(a<=1) L.log.push('病人已經對叫聲有反應，唔使再做痛楚刺激');
        setTimeout(()=>log(r==='over'?'✊ 病人即刻縮開、喊痛。':r==='P'?'✊ 擠壓斜方肌後，病人皺眉、呻吟、縮手。':'✊ 擠壓斜方肌：都係冇反應。'),1000); }
      if(!st.locShown){ st.locShown=1; Qp.style.display=''; AN.style.display=''; } }; O.append(b); });
    ['A 清醒','V 對說話有反應','P 對痛楚有反應','U 冇反應'].forEach((t,i)=>{ const b=document.createElement('button'); b.innerHTML='<i>'+'AVPU'[i]+'</i>'+t; b.dataset.i=i; b.onclick=()=>locAnswer(c,a,i,b,L); AN.append(b); });
    st.locShown=0; st.max+=15; }
  function locAnswer(c,a,i,b,L){ if(st.state!=='loc') return; st.state='fb';
    const need=i===0?['obs']:i===1?['voice']:['voice','pain']; need.forEach(k=>{ if(!L[k]) L.log.push('未做「'+(k==='obs'?'觀察':k==='voice'?'叫佢':'擠壓斜方肌')+'」就判斷'); });
    const ok=i===a; box.querySelectorAll('.lans button').forEach(x=>{ x.disabled=true; if(+x.dataset.i===a) x.classList.add('ok'); else if(x===b) x.classList.add('no'); }); box.querySelectorAll('.lact button').forEach(x=>x.disabled=true);
    const proc=Math.max(0,5-L.log.length*3); st.score+=(ok?10:0)+proc; if(!ok){ st.ansErr++; st.t+=30; st.log.push('LOC：'+['A','V','P','U'][a]); } if(L.log.length) st.log.push('LOC 測試次序：'+L.log.join('、'));
    (c.reveal||[]).forEach(r=>st.known[r]=1); st.locHold=null; SIMAN.apply();
    const w=document.createElement('div'); w.className='why'; w.innerHTML=(ok?'✅ 正確：':'❌ 正確答案：')+esc(['A 清醒','V 對說話有反應','P 對痛楚有反應','U 冇反應'][a])+'。<br>'+(L.log.length?'⚠️ '+esc(L.log.join('；'))+'。<br>':'✅ 測試次序正確。<br>')+'正確次序：先觀察 → 冇自己開眼就大聲叫 → 叫都冇反應先擠壓斜方肌。A 清醒、V 對說話有反應、P 對痛楚有反應、U 完全冇反應。';
    box.append(w); addTip(c); vib(ok?20:[40,40,40]); showGo('繼續 ▶'); }
  function mistStep(c){ st.state='mist'; const L=['M','I','S','T'], N=['Mechanism／主訴','Injuries／檢查所見','Signs／維生指數','Treatment／處理']; const ord=shuffle([0,1,2,3]); let n=0, err=0;
    box.innerHTML='<h3>MIST · 交接</h3><p class="act">🧑‍⚕️ '+esc(c.act)+'</p><p class="q">按 MIST 次序撳：'+(st.diff?'M → I → S → T':L.map((l,i)=>l+' '+N[i]).join(' → '))+'</p><div class="opts mist"></div>';
    const O=box.querySelector('.mist'); ord.forEach(i=>{ const b=document.createElement('button'); b.innerHTML=esc(c.mist[i]); b.onclick=()=>{ if(b.disabled) return; if(i===n){ b.disabled=true; b.classList.add('ok'); b.innerHTML='<b>'+L[i]+'</b>'+esc(c.mist[i]); n++; if(n===4){ st.score+=Math.max(0,10-err*3); st.max+=10; if(err) st.log.push('MIST 次序（錯 '+err+' 次）'); showGo('完成交接 ▶'); } }
        else { err++; b.classList.add('no'); setTimeout(()=>b.classList.remove('no'),400); } }; O.append(b); }); }
  function next(){ hideGo(); st.i++; if(st.i<st.steps.length){ pickPrompt(); return; }
    if(st.phase==='scene'){ SIMAN.leaveScene(); st.phase='trans'; st.open=false; st.tScene=st.t; document.body.classList.remove('simScene'); box.innerHTML=''; S.simSceneDone=true; PLAY.radio('A188 '+st.sc.title+'，LOAD & GO，送院途中。','A188'); }
    else { st.open=false; document.body.classList.remove('simScene'); S.simHandDone=true; SIMAN.leaveScene(); result(); } }
  function grade(){ const p=st.max?st.score/st.max:0; return p>=0.9?['金','#d4a017']:p>=0.75?['銀','#9aa5b1']:p>=0.55?['銅','#b87333']:['再練習','#e05252']; }
  function result(){ const g=grade(), key=st.sc.id+(st.diff?'p':'e'), B=store.get('simBest',{}), rank={'金':3,'銀':2,'銅':1,'再練習':0}; if(!B[key]||rank[g[0]]>rank[B[key]]){ B[key]=g[0]; store.set('simBest',B); }
    st.summary='🩺 現場模擬：'+st.sc.title+'（'+(st.diff?'專業':'入門')+'）· 分支：'+st.sc.varLabel+' · 評級 '+g[0]+' · 得分 '+Math.max(0,st.score)+'／'+st.max+' · 現場時間 '+fmtT(st.tScene)+' · 次序出錯 '+st.orderErr+' · 答錯 '+st.ansErr+(st.log.length?'<br>要溫習：'+st.log.map(esc).join('；'):''); }
  const fmtT=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
  function kneelAnim(){ st.anim=1.6; }
  /* ----- 監測器 ----- */
  let ph=0; const ecg=[]; for(let i=0;i<300;i++) ecg.push(23);
  function wave(p,r){ if(r==='noise') return (Math.random()-0.5)*16+Math.sin(p*40)*6; if(r==='vf') return Math.sin(p*31)*7+Math.sin(p*17+1)*5+(Math.random()-0.5)*3; if(r==='asys') return (Math.random()-0.5)*1.2; const x=p%1; if(x<0.08) return -Math.sin(x/0.08*Math.PI)*3; if(x>0.12&&x<0.14) return 4; if(x>=0.14&&x<0.17) return -22*(1-Math.abs(x-0.155)/0.015); if(x>=0.17&&x<0.19) return 6; if(x>0.32&&x<0.45) return -Math.sin((x-0.32)/0.13*Math.PI)*5; return 0; }
  function tick(dt){ if(!st.on) return;
    if(st.phase==='trans'&&!st.drive&&S.step===4&&S.mode==='drive'&&!st.jumped&&S.target){ st.jumped=true; S.car.x=S.target[0]; S.car.z=S.target[1]; }
    if(!document.body.classList.contains('simScene')) return;
    if((st.lt=(st.lt||0)-dt)<0){ st.lt=0.4; layout(); }
    Object.keys(st.d).forEach(k=>{ if(typeof st.v[k]==='number') st.d[k]+=(st.v[k]-st.d[k])*Math.min(1,dt*0.8); else st.d[k]=st.v[k]; });
    const K=st.known, d=st.d; const set=(id,t)=>{ const e=$s(id); if(e.textContent!==t) e.textContent=t; };
    set('smHr',K.hr?String(Math.round(d.hr+(Math.random()<0.1?(Math.random()-0.5)*2:0))):'--'); set('smBp',K.sbp?Math.round(d.sbp)+'/'+Math.round(d.dbp):'--'); set('smSp',K.spo2?Math.round(d.spo2)+'%':'--'); set('smRr',K.rr?String(Math.round(d.rr)):'--');
    set('smLc',K.avpu?AVPU[Math.round(d.avpu)]+(d.gcs<15?'·'+Math.round(d.gcs):''):'--'); set('smBs',K.rbs?d.rbs.toFixed(1):'--'); set('smPn',K.pain?Math.round(d.pain)+'/10':'--'); set('smTm',fmtT(st.t));
    const cv=$s('simEcg'), g=cv.getContext('2d'); const rh=st.v.rhythm||'sinus', hr=K.hr?(rh==='vf'||rh==='asys'?60:Math.max(d.hr,30)):0; ph+=dt*(hr/60); const spd=120*dt; for(let n=0;n<Math.max(1,Math.round(spd));n++){ ecg.shift(); ecg.push(23+(K.hr?wave(ph-n*0.002,rh):0)); }
    g.fillStyle='#020403'; g.fillRect(0,0,300,46); g.strokeStyle='#0f2a18'; g.lineWidth=1; for(let x=0;x<300;x+=15){ g.beginPath(); g.moveTo(x,0); g.lineTo(x,46); g.stroke(); }
    g.strokeStyle=K.hr?'#3ddc6a':'#1d4d2c'; g.lineWidth=2; g.beginPath(); ecg.forEach((y,x)=>x?g.lineTo(x,y):g.moveTo(x,y)); g.stroke(); }
  // 鍵盤：1–4 答題、Enter 繼續
  addEventListener('keydown',e=>{ if(!st.on||!document.body.classList.contains('simScene')||typing(e)) return;
    if(/^Digit[1-6]$/.test(e.code)){ const b=box.querySelectorAll('.opts button')[+e.code.slice(5)-1]; if(b&&!b.disabled){ b.click(); e.preventDefault(); } }
    if(e.code==='Enter'&&GO.style.display==='block'){ GO.click(); e.preventDefault(); } });
  /* ----- 選單 ----- */
  function menu(B,el){ const diff=store.get('simDiff',0), drive=store.get('simDrive',false), best=store.get('simBest',{});
    B.append(el('p',null,'跟救護規程（資料來源：ems.homes）一步一步處理現場：RSE → LOC → D → CAB → O₂ → RBS → SKIN → DECISION → 病史 → 維生指數 → 用藥 (5R) → LOAD & GO，送院途中再評估，最後用 MIST 交接。'));
    const seg=(items,cur,fn)=>{ const s=el('div','simSeg'); items.forEach(([t,d],v)=>{ const b=el('button',+cur===v?'on':null); b.append(el('span',null,t),el('small',null,d)); b.onclick=()=>{ fn(v); renderMenu('levels'); }; s.append(b); }); return s; };
    B.append(seg([['🙂 入門','市民：有提示、淺白題目'],['🧑‍⚕️ 專業','同事：自己揀下一步、規程劑量']],diff,v=>store.set('simDiff',v)));
    B.append(seg([['⏩ 直接到場','專心練現場處理'],['🚑 包括揸車','由救護站出車']],drive?1:0,v=>store.set('simDrive',!!v)));
    const CAT={'藥':'💊 用藥 Protocol','停':'🫀 心臟驟停','傷':'🩹 創傷','準':'📋 準則／器材'};
    B.append(el('p',null,'共 '+SC.length+' 關，每關一個 Protocol；每次開始會隨機抽一個規程分支（例如有冇禁忌症、唔同年齡體重、唔同讀數），玩多幾次會遇到唔同情況。'));
    Object.keys(CAT).forEach(ct=>{ B.append(el('h4','simCat',CAT[ct])); SC.filter(sc=>sc.cat===ct).forEach(sc=>{ const b=el('button','simCase'); b.append(el('span','ic',sc.ic),(()=>{ const d=el('div'); d.append(el('b',null,sc.title),el('span',null,sc.en+' · '+sc.vars.length+' 個分支')); return d; })(), el('em',null,best[sc.id+(diff?'p':'e')]||''));
      b.onclick=()=>{ S.realPick=false; S.pcPick=false; const lv=sc.lv%LEVELS.length; startCase(lv); begin(sc,diff,drive); }; B.append(b); }); });
    B.append(el('p','rules','⚠️ 呢個係訓練遊戲，個案為模擬；實際處理以消防處最新規程為準。')); }
  function again(){ SIMAN.clear(); const s=st; const sc=s.sc.base, d=s.diff, dr=s.drive; S.simOn=false; startCase(sc.lv%LEVELS.length); begin(sc,d,dr); }
  function anim(dt,t){ SIMAN.tick(dt,t,st.d.rr,st.v.rhythm,st.phase==='hosp',st.locHold!=null?st.locHold:st.d.avpu); }
  return {_use:(id)=>useTool(id,null),SC,anim,cam:t=>SIMAN.cam(t),CH,again,begin,end,atScene,atHosp,tick,menu,get summary(){ return st.summary; },get on(){ return st.on; },SC,_st:st};
})();
window.__SIM=SIM;

/* ---------- 🚗 駕駛操控：真實設定（自動波 D／R、油門、煞車、軚盤）＋ 倒車動畫（救護員落車睇後） ---------- */
const DRV=(()=>{
  const D={real:!!store.get('realDrive',false), rev:store.get('revAnim',true)!==false, gear:'D', ang:0, drag:null, pad:0, sgn:0};
  const MAXA=150;                       // 軚盤最多扭 150°
  const css=document.createElement('style'); css.textContent=`
  #steerW{display:none;width:150px;height:150px;margin-bottom:14px;touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab;position:relative}
  body.realDrv #steerW{display:block} body.realDrv .btns .lr{display:none!important}
  #steerW svg{width:100%;height:100%;filter:drop-shadow(0 4px 10px #0008);transition:none}
  #steerW .hint{position:absolute;left:0;right:0;bottom:-16px;text-align:center;font-size:11px;font-weight:800;color:#fff;text-shadow:0 1px 3px #000}
  #bGear{display:none;font-weight:900;font-size:20px;letter-spacing:1px}
  body.realDrv #bGear{display:block} #bGear.r{background:#d64545;color:#fff} #bGear.d{background:#2b6fd6;color:#fff}
  #revTip{position:fixed;left:50%;top:calc(110px + env(safe-area-inset-top));transform:translateX(-50%);z-index:30;background:#000b;color:#ffd166;font-weight:800;font-size:14px;padding:6px 12px;border-radius:16px;display:none;pointer-events:none}
  @media (max-width:520px){ #steerW{width:124px;height:124px} }`;
  document.head.append(css);
  // 軚盤 SVG
  const W=document.createElement('div'); W.id='steerW'; W.setAttribute('aria-label','軚盤：左右滑動轉彎');
  W.innerHTML='<svg viewBox="0 0 100 100"><g id="swRot"><circle cx="50" cy="50" r="44" fill="none" stroke="#1d2430" stroke-width="10"/><circle cx="50" cy="50" r="44" fill="none" stroke="#3a4558" stroke-width="3"/>'+
    '<path d="M8 52 Q50 40 92 52" fill="none" stroke="#1d2430" stroke-width="9"/><path d="M50 56 L50 92" stroke="#1d2430" stroke-width="9"/>'+
    '<circle cx="50" cy="54" r="13" fill="#2a3342" stroke="#11161e" stroke-width="2"/><text x="50" y="58" text-anchor="middle" font-size="9" font-weight="900" fill="#ffd166">A188</text>'+
    '<rect x="46" y="3" width="8" height="9" rx="2" fill="#ffcf5a"/></g></svg><div class="hint">◀ 滑動軚盤 ▶</div>';
  const btns=document.querySelector('.btns'); if(btns) btns.insertBefore(W,btns.firstChild);
  const rot=W.querySelector('#swRot');
  W.addEventListener('pointerdown',e=>{ e.preventDefault(); W.setPointerCapture&&W.setPointerCapture(e.pointerId); D.drag={x:e.clientX,a:D.ang,id:e.pointerId}; W.style.cursor='grabbing'; });
  W.addEventListener('pointermove',e=>{ if(!D.drag||e.pointerId!==D.drag.id) return; D.ang=Math.max(-MAXA,Math.min(MAXA,D.drag.a+(e.clientX-D.drag.x)*1.5)); });
  ['pointerup','pointercancel','lostpointercapture'].forEach(ev=>W.addEventListener(ev,e=>{ if(D.drag&&e.pointerId===D.drag.id){ D.drag=null; W.style.cursor='grab'; } }));
  // 波棍掣（D／R）
  const G=document.createElement('button'); G.className='btn small d'; G.id='bGear'; G.textContent='D'; G.setAttribute('aria-label','波棍：前波 D／後波 R');
  const col=document.querySelector('.btns .col'); if(col) col.insertBefore(G,col.firstChild);
  G.addEventListener('pointerdown',e=>{ e.preventDefault(); shift(); });
  const tip=document.createElement('div'); tip.id='revTip'; document.body.append(tip);
  const bB=$('bB');
  function applyReal(){ document.body.classList.toggle('realDrv',D.real); if(bB){ bB.textContent=D.real?'煞':'倒'; bB.setAttribute('aria-label',D.real?'煞車':'倒車'); } paintGear(); }
  function paintGear(){ G.textContent=D.gear; G.className='btn small '+(D.gear==='R'?'r':'d'); }
  function shift(to){ const c=S.car; if(!D.real||S.mode!=='drive') return; const nx=to||(D.gear==='D'?'R':'D'); if(nx===D.gear) return;
    if(Math.abs(c.v)>0.6){ toast('停定車先可以轉波'); return; } D.gear=nx; paintGear(); if(navigator.vibrate) try{ navigator.vibrate(15); }catch(e){} }
  addEventListener('keydown',e=>{ const t=e.target; if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA')) return; if(e.code==='KeyR'&&!e.repeat&&D.real) shift(); });
  applyReal();

  /* ----- 倒車動畫：救護員由左邊落車 → 行去車尾睇後 → 轉前波時跑返上車頭 ----- */
  const man=person('crew'); man.visible=false; scene.add(man);
  const g={st:'in',t:0,from:null,to:null,side:1};
  const WALK=1.5;
  const cornerPos=()=>{ const b=basis(), k=g.side*(b.Wd+0.6); return [b.c.x-b.fx*(b.L+1.6)+b.lx*k, b.c.z-b.fz*(b.L+1.6)+b.lz*k]; };
  const canGuide=()=>D.rev&&S.mode==='drive'&&!(S.gm==='free'&&typeof FRE!=='undefined'&&FRE.onFoot)&&VSPEC.kind!=='moto'&&!(typeof FUN!=='undefined'&&FUN.on);
  function basis(){ const c=S.car, fx=Math.sin(c.a), fz=Math.cos(c.a), lx=Math.cos(c.a), lz=-Math.sin(c.a); return {c,fx,fz,lx,lz,L:3.2*VSPEC.kl+0.4,Wd:1.25*VSPEC.kw}; }
  const doorPos=(sd)=>{ const b=basis(), k=(sd||g.side)*(b.Wd+0.7); return [b.c.x+b.fx*1.3+b.lx*k, b.c.z+b.fz*1.3+b.lz*k]; };
  const rearPos=(sd)=>{ const b=basis(), k=(sd||-1)*(b.Wd+0.5); return [b.c.x-b.fx*(b.L+1.9)+b.lx*k, b.c.z-b.fz*(b.L+1.9)+b.lz*k]; };
  const freeAt=P=>{ try{ return !blockedAt(P[0],P[1],6); }catch(e){ return true; } };
  const ARM=()=>{ const a=man.userData.arms; return Array.isArray(a)?a[1]||a[0]:a; };
  function go(st){ g.st=st; g.t=0; g.leg=0; if(!man.visible){ g.side=freeAt(doorPos(1))?1:freeAt(doorPos(-1))?-1:1; g.leg=0; const d=doorPos(); man.position.set(d[0],0.12,d[1]); man.visible=true; } g.from=[man.position.x,man.position.z]; }
  function reset(){ g.st='in'; man.visible=false; tip.style.display='none'; const a=ARM(); if(a) a.rotation.x=0; }
  function showTip(t){ tip.textContent=t; tip.style.display=t?'block':'none'; }
  function guideTick(dt,t,moving){ if(g.st==='in') return; const b=basis(); g.t+=dt; let P; const a=ARM();
    if(g.st==='out'||g.st==='back'){ // 經車尾轉角行：左門 → 車尾左角 → 車右後方（返程倒轉）
      const route=g.st==='out'?[cornerPos(),rearPos()]:(g.side===1?[cornerPos(),doorPos()]:[doorPos()]); const leg=Math.min(g.leg||0,route.length-1);
      const k=Math.min(1,g.t/(WALK*0.6)), A=g.from, Bq=route[leg]; P=[A[0]+(Bq[0]-A[0])*k, A[1]+(Bq[1]-A[1])*k];
      if(k>=1&&leg<route.length-1){ g.leg=leg+1; g.t=0; g.from=[P[0],P[1]]; man.position.set(P[0],0.12,P[1]); return; }
      walk(man,g.st==='back'?t*1.4:t,true); if(Math.hypot(Bq[0]-A[0],Bq[1]-A[1])>0.2) man.rotation.y=Math.atan2(Bq[0]-A[0],Bq[1]-A[1]); if(a) a.rotation.x=0;
      showTip(g.st==='out'?'🧍 救護員落車去車尾睇後……':'🏃 救護員跑返上車頭……');
      if(k>=1&&leg>=route.length-1){ if(g.st==='out') g.st='guide'; else { reset(); return; } } }
    else if(g.st==='guide'){ P=rearPos(); walk(man,t,moving); man.rotation.y=b.c.a; if(a) a.rotation.x=-1.7+Math.sin(t*5)*0.45; showTip(moving?'🧍「後面冇嘢，繼續倒！」':'🧍 救護員喺車尾睇住，可以倒車'); }
    if(P) man.position.set(P[0],0.12,P[1]); }

  /* ----- 每格：將按掣變成油／煞／軚 ----- */
  function input(dt,t){ const H=S.hold, c=S.car;
    // 軚盤（真實設定）或者 ◀ ▶
    let steer;
    if(D.real){ const kb=(H.L?1:0)-(H.R?1:0);
      if(Math.abs(D.pad)>0.12&&!D.drag) D.ang=-D.pad*MAXA;
      else if(kb&&!D.drag) D.ang=Math.max(-MAXA,Math.min(MAXA,D.ang-kb*300*dt));
      else if(!D.drag){ const r=(Math.abs(c.v)>3?320:200)*dt; D.ang=Math.abs(D.ang)<=r?0:D.ang-Math.sign(D.ang)*r; }   // 放手自動回正
      { const n=D.ang/MAXA; steer=-n; } rot.setAttribute('transform','rotate('+D.ang.toFixed(1)+' 50 50)'); }
    else steer=Math.abs(D.pad)>0.35?-Math.sign(D.pad):(H.L?1:0)-(H.R?1:0);
    D.sgn=steer>0.15?1:steer<-0.15?-1:0;
    // 想向前／向後
    let gas=!!H.G, brake=!!H.B, G2, B2, wantBack, wantFwd;
    if(D.real){ if(D.gear==='D'){ G2=gas&&!brake; B2=brake; wantFwd=gas; wantBack=false; } else { G2=brake; B2=gas&&!brake; wantBack=gas; wantFwd=false; } }
    else { G2=gas; B2=brake; wantBack=brake&&!gas&&c.v<=0.5; wantFwd=gas&&!brake&&c.v>=-0.5; }
    // 倒車動畫：未有人喺車尾就唔倒；人未上返車就唔向前
    if(canGuide()){
      const backReq=D.real?D.gear==='R':wantBack, fwdReq=D.real?D.gear==='D':wantFwd;
      if(backReq&&(g.st==='in'||g.st==='back')) go('out');
      else if(fwdReq&&(g.st==='out'||g.st==='guide')) go('back');
      if(g.st==='out'){ if(D.real) B2=false; else if(wantBack) B2=false; }
      if(g.st==='back'){ if(D.real) G2=false; else if(wantFwd) G2=false; }
      guideTick(dt,t,Math.abs(c.v)>0.3);
    } else if(g.st!=='in') reset();
    return {G:G2,B:B2,steer,L:D.sgn>0,R:D.sgn<0}; }
  // 物理之後：真實設定 D 波唔會溜後、R 波唔會向前
  function post(){ if(!D.real) return; const c=S.car; if(D.gear==='D'&&c.v<0) c.v=0; if(D.gear==='R'&&c.v>0) c.v=0; }
  function setReal(v){ D.real=!!v; store.set('realDrive',D.real); D.gear='D'; D.ang=0; applyReal(); }
  function setRev(v){ D.rev=!!v; store.set('revAnim',D.rev); if(!v) reset(); }
  return {man,input,post,setReal,setRev,shift,reset,get wheel(){ return D.real?D.ang:null; },get real(){ return D.real; },get rev(){ return D.rev; },get gear(){ return D.gear; },set pad(v){ D.pad=v; },get sgn(){ return D.sgn; },_g:g};
})();
window.__DRV=DRV;

/* ---------- 👁️ 視線：四個視點 —— ① 救護任務 ② 寫實 ③ 貼車（駕駛追尾）④ 車內（駕駛位、左右倒後鏡、車頭倒後鏡、軚盤、儀錶板） ----------
   參考 A188 駕駛室相：右軚、中間「A 188」車號牌、警號控制板、無線電、平板、儀錶。所有車號一律 A188。 */
const VIEW=(()=>{
  const NAMES=['救護任務','寫實','貼車','車內'], ICON=['🚑','🎬','🎯','🪟'];
  const V={user:store.get('viewSel',null), mi:0, fr:0, rects:null, lastCk:false};
  const cockOK=()=>VSPEC.kind!=='moto';
  // 未揀過：跟返「寫實模式」開唔開；電單車冇車內視線
  const cur=()=>{ let n=V.user!=null?V.user:(REAL.on?1:0); if(n===3&&!cockOK()) n=REAL.on?1:0; return n; };
  const css=document.createElement('style'); css.textContent=`
  #bView{pointer-events:auto;position:fixed;top:calc(186px + env(safe-area-inset-top));right:10px;border:0;border-radius:99px;background:rgba(255,255,255,.95);font:inherit;font-size:12px;padding:6px 10px;box-shadow:0 2px 8px rgba(0,0,0,.12);z-index:12;display:none}
  body.vOn #bView{display:block}
  body.pc #bView{background:#0b0e14b8;color:#e8edf3;border:1px solid #ffffff22}
  #ck{display:none;position:fixed;inset:0;pointer-events:none;overflow:hidden;font-family:inherit}
  body.ckOn #ck{display:block} body.ckOn #speedfx{display:none!important}
  #ck .roof{position:absolute;left:0;right:0;top:0;height:7vh;background:linear-gradient(#14171b,#262a31 70%,#1d2026);box-shadow:0 3px 10px #0008}
  #ck .pl{position:absolute;inset:0;background:linear-gradient(90deg,#15181c,#2a2f36)}
  #ck .pl.l{clip-path:polygon(0 0,8vw 0,2.6vw 64vh,0 66vh)} #ck .pl.r{clip-path:polygon(92vw 0,100vw 0,100vw 66vh,97.4vw 64vh);background:linear-gradient(270deg,#15181c,#2a2f36)}
  #ck .mir{position:absolute;border:6px solid #16191e;border-radius:14px;box-shadow:0 4px 12px #000a,inset 0 0 0 2px #000;box-sizing:border-box}
  #ck .mir .glass{width:100%;height:100%;border-radius:8px;box-shadow:inset 0 0 10px #0006}
  #ck .mir.rv{left:50%;top:calc(7vh + 8px);transform:translateX(-30%);width:clamp(150px,34vmin,330px);height:clamp(44px,8.5vmin,82px);border-radius:12px}
  #ck .mir.rv::before{content:'';position:absolute;left:50%;top:-16px;width:10px;height:12px;margin-left:-5px;background:#111;border-radius:3px}
  #ck .mir.sl{left:6vw;top:43vh;width:clamp(64px,17vmin,170px);height:clamp(46px,12vmin,120px);border-radius:12px 18px 18px 12px}
  #ck .mir.sr{right:6vw;top:41vh;width:clamp(72px,19vmin,190px);height:clamp(52px,13.5vmin,134px);border-radius:18px 12px 12px 18px}
  #ck .dash{position:absolute;left:0;bottom:0;width:100%;height:44vh}
  #ck .vent{position:absolute;left:5vw;top:68vh;width:9vmin;height:9vmin;border-radius:50%;background:radial-gradient(#000 40%,#2b2f36 42%,#111 60%,#3a3f47 63%,#15171b 74%);box-shadow:0 0 0 .6vmin #0a0b0d}
  #ck .st{position:absolute;left:18vw;top:57vh;width:24vmin;height:12vmin;background:linear-gradient(#e9edf2,#c9ced6);border-radius:1vmin;box-shadow:0 .6vmin 1.2vmin #0008;padding:1vmin 1.2vmin;box-sizing:border-box}
  #ck .st .lcd{height:5vmin;background:#8fb7d6;border:.3vmin solid #3c4654;border-radius:.4vmin;font:700 2.1vmin/4.6vmin monospace;color:#123;padding:0 1vmin;white-space:nowrap;overflow:hidden}
  #ck .st .ks{display:flex;gap:.7vmin;margin-top:1vmin} #ck .st .ks i{flex:1;height:2.4vmin;border-radius:.4vmin;background:#2f6fd6} #ck .st .ks i:nth-child(1){background:#3fae5a} #ck .st .ks i:nth-child(5){background:#d64545}
  #ck .it{position:absolute;bottom:39.6vh} #ck.na .it.box,#ck.na .st{display:none}
  #ck .it.box{left:49vw;width:13vmin;height:8vmin;background:linear-gradient(#fff,#e6eaef);border-radius:.4vmin;box-shadow:0 .5vmin 1vmin #0007}
  #ck .it.box::after{content:'PROCEDURE MASK';position:absolute;left:0;right:0;top:3vmin;font:800 1.2vmin sans-serif;color:#1f4fbf;text-align:center}
  #ck .it.cup{left:61vw;width:5vmin;height:6.5vmin;background:linear-gradient(90deg,#e8e4dc,#fff,#d9d4ca);border-radius:.4vmin .4vmin 1.4vmin 1.4vmin}
  #ck .it.cup::before{content:'';position:absolute;left:-.4vmin;right:-.4vmin;top:-.6vmin;height:1vmin;background:#f4f4f4;border-radius:.5vmin}
  #ck .it.bt{left:66vw;width:4vmin;height:7.5vmin;background:linear-gradient(90deg,#b8d0e0cc,#eef6ffcc,#b8d0e0cc);border-radius:1vmin}
  #ck .it.bt::before{content:'';position:absolute;left:1vmin;right:1vmin;top:-1.4vmin;height:1.6vmin;background:#8a5ad6;border-radius:.4vmin}
  #ck .stack{position:absolute;left:33vw;top:62vh;width:30vmin;height:30vh;background:linear-gradient(#17191d,#22262c);border-radius:2vmin 2vmin 0 0;box-shadow:inset 0 0 0 .4vmin #0c0d10;display:flex;flex-direction:column;align-items:center;gap:1.2vmin;padding-top:1.4vmin;box-sizing:border-box}
  #ck .num{background:#fff;color:#111;font:900 3.6vmin/1 Arial,sans-serif;padding:.5vmin 1.6vmin;border:.3vmin solid #222;letter-spacing:.2vmin}
  #ck .sir{display:grid;grid-template-columns:repeat(5,3.6vmin);gap:.6vmin;background:#0c0e11;padding:1vmin;border-radius:.6vmin}
  #ck .sir i{height:3.2vmin;border-radius:.4vmin;background:#3a3f47;box-shadow:inset 0 0 0 .2vmin #555}
  #ck .sir i:nth-child(3){grid-row:span 2;height:auto;background:#141a12}
  body.ckSir #ck .sir i:nth-child(odd):not(:nth-child(3)){animation:ckB .5s steps(1) infinite} body.ckSir #ck .sir i:nth-child(even){animation:ckB .5s steps(1) .25s infinite}
  @keyframes ckB{0%{background:#2f8bff;box-shadow:0 0 1.4vmin #2f8bff}50%{background:#3a3f47;box-shadow:none}}
  #ck .rad{width:22vmin;height:6vmin;background:#0b0c0f;border-radius:.6vmin;display:flex;align-items:center;gap:1vmin;padding:0 1vmin;box-sizing:border-box}
  #ck .rad b{flex:1;height:3.6vmin;background:#9cc0ff;color:#0b2560;font:800 1.8vmin/3.6vmin monospace;padding-left:.8vmin;border-radius:.3vmin;overflow:hidden;white-space:nowrap}
  #ck .rad i{width:3vmin;height:3vmin;border-radius:50%;background:#2a2e35;box-shadow:inset 0 0 0 .3vmin #555} #ck .rad i.r{background:#d32f2f}
  #ck .clu{position:absolute;left:67vw;top:59vh;width:30vmin;height:15vmin;background:#0a0b0d;border-radius:7vmin 7vmin 2vmin 2vmin;box-shadow:inset 0 .6vmin 1.2vmin #000,0 0 0 .6vmin #1c1f24;display:flex;align-items:center;justify-content:space-around;padding:0 1vmin;box-sizing:border-box}
  #ck .clu svg{width:12.5vmin;height:12.5vmin} #ck .clu .mid{font:800 2.2vmin monospace;color:#9fe0ff;text-align:center;line-height:1.2}
  #ck .tab{position:absolute;left:41vw;top:78vh;width:30vmin;height:22vmin;background:#202227;border-radius:1.6vmin;box-shadow:0 0 0 .8vmin #e8a21a,0 1vmin 2vmin #000a;padding:1.4vmin;box-sizing:border-box}
  #ck .tab canvas{width:100%;height:100%;border-radius:.6vmin;background:#0d1116;display:block}
  #ck .tab .tag{position:absolute;right:1.4vmin;top:-.4vmin;background:#ffd400;color:#111;font:900 1.7vmin/1 Arial,sans-serif;padding:.4vmin .8vmin;border-radius:.3vmin}
  #ck .wh{position:absolute;left:78vw;top:97vh;width:66vmin;height:66vmin;transform:translate(-50%,-50%)}
  #ck .wh svg{width:100%;height:100%;filter:drop-shadow(0 1.4vmin 2vmin #000c)}
  @media (orientation:landscape) and (max-height:520px){ #ck .mir.sr{right:12.5vw} #ck .mir.sl{left:7vw} }
  @media (orientation:portrait){ #ck .pl.l{clip-path:polygon(0 0,7vw 0,2vw 60vh,0 62vh)} #ck .pl.r{clip-path:polygon(93vw 0,100vw 0,100vw 62vh,98vw 60vh)}
    #ck .dash{height:40vh} #ck .st{left:6vw;top:60vh} #ck .it{display:none} #ck .stack{left:22vw;top:66vh;width:34vmin} #ck .clu{left:56vw;top:63.5vh;width:38vmin;height:19vmin} #ck .clu svg{width:16vmin;height:16vmin}
    #ck .tab{left:30vw;top:84vh;width:38vmin;height:28vmin} #ck .roof{height:12vh} #ck .mir.rv{top:calc(12vh + 16px);transform:translateX(-50%);width:clamp(120px,34vmin,330px)} #ck .wh{left:74vw;top:96vh;width:80vmin;height:80vmin} #ck .vent{display:none} #ck .mir.sl{top:46vh} #ck .mir.sr{top:44vh} }`;
  document.head.append(css);

  // 掣：👁️ 視線
  const B=document.createElement('button'); B.id='bView'; B.setAttribute('aria-label','切換視線');
  const aeb=$('bAEB'); (aeb&&aeb.parentNode?aeb.parentNode:document.body).insertBefore(B,aeb?aeb.nextSibling:null);
  B.addEventListener('click',()=>cycle());
  addEventListener('keydown',e=>{ const t=e.target; if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA')) return; if(e.code==='KeyV'&&!e.repeat&&document.body.classList.contains('vOn')) cycle(); });
  let painted=-1; function paint(){ const i=cur(); if(i===painted) return; painted=i; B.textContent='👁️ '+ICON[i]+' '+NAMES[i]; }
  // 跟住「防撞」掣下面排（各模式位置唔同）
  setInterval(()=>{ const a=$('bAEB'); const show=!!(a&&a.getClientRects().length&&getComputedStyle(a).visibility!=='hidden'&&['drive','over','seq','hseq'].includes(S.mode)&&!(S.gm==='cpr'));
    document.body.classList.toggle('vOn',show); if(!show) return; paint(); const r=a.getBoundingClientRect();
    B.style.top=(r.bottom+6)+'px'; if(document.body.classList.contains('pc')){ B.style.left=r.left+'px'; B.style.right='auto'; } else { B.style.right=(innerWidth-r.right)+'px'; B.style.left='auto'; } },400);
  function cycle(){ let n=(cur()+1)%4; if(n===3&&!cockOK()) n=0; V.user=n; store.set('viewSel',n); paint(); toast('視線：'+ICON[n]+' '+NAMES[n]+(n===3?'（拖拉畫面可以轉頭望）':'')); }
  paint();

  // 駕駛室畫面（HTML 疊喺 3D 上面）
  const ck=document.createElement('div'); ck.id='ck'; ck.setAttribute('aria-hidden','true');
  const tick=(i,n,r0,r1)=>{ let s=''; for(let k=0;k<=n;k++){ const a=(-120+240*k/n)*Math.PI/180, L=k%2?r1+4:r1; s+=`<line x1="${(Math.sin(a)*r0).toFixed(1)}" y1="${(-Math.cos(a)*r0).toFixed(1)}" x2="${(Math.sin(a)*L).toFixed(1)}" y2="${(-Math.cos(a)*L).toFixed(1)}"/>`; } return s; };
  const gauge=(id,n,lab)=>`<svg viewBox="-50 -50 100 100"><circle r="47" fill="#08090b" stroke="#5c636e" stroke-width="2.5"/><g stroke="#e8edf3" stroke-width="2">${tick(0,n,40,34)}</g>`+
    lab.map((t,k)=>{ const a=(-120+240*k/(lab.length-1))*Math.PI/180; return `<text x="${(Math.sin(a)*25).toFixed(1)}" y="${(-Math.cos(a)*25+3).toFixed(1)}" font-size="9" fill="#e8edf3" text-anchor="middle" font-family="Arial" font-weight="700">${t}</text>`; }).join('')+
    `<g id="${id}"><line y1="6" y2="-40" stroke="#ff5a36" stroke-width="3" stroke-linecap="round"/></g><circle r="5" fill="#2a2e35"/></svg>`;
  ck.innerHTML=`<div class="roof"></div><div class="pl l"></div><div class="pl r"></div>
    <svg class="dash" viewBox="0 0 1000 400" preserveAspectRatio="none"><defs><linearGradient id="ckG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3f47"/><stop offset=".25" stop-color="#2a2e35"/><stop offset="1" stop-color="#15171b"/></linearGradient></defs>
      <path d="M0 60 C180 40 420 32 640 40 C680 22 720 6 800 4 C900 2 960 10 1000 18 L1000 400 L0 400 Z" fill="url(#ckG)"/><path d="M0 60 C180 40 420 32 640 40 C680 22 720 6 800 4 C900 2 960 10 1000 18" fill="none" stroke="#565c66" stroke-width="3" vector-effect="non-scaling-stroke"/>
      <path d="M40 120 C260 100 470 96 640 104" fill="none" stroke="#1b1e23" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
    <div class="vent"></div>
    <div class="st"><div class="lcd" id="ckSt">STATUS</div><div class="ks"><i></i><i></i><i></i><i></i><i></i></div></div>
    <div class="it box"></div><div class="it cup"></div><div class="it bt"></div>
    <div class="stack"><div class="num" id="ckNum">A 188</div><div class="sir"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="rad"><b id="ckRad">FSD · A188</b><i></i><i class="r"></i></div></div>
    <div class="clu">${gauge('ckN1',14,['0','40','80','120','140'])}<div class="mid"><span id="ckSpd">0</span><br><small>km/h</small><br><span id="ckGear">D</span></div>${gauge('ckN2',10,['0','1','2','3','4','5'])}</div>
    <div class="tab"><canvas id="ckTab" width="260" height="180"></canvas><span class="tag">A0188</span></div>
    <div class="wh"><svg viewBox="-100 -100 200 200"><g id="ckWh">
      <circle r="86" fill="none" stroke="#141619" stroke-width="15"/><circle r="86" fill="none" stroke="#2c3037" stroke-width="3"/>
      <path d="M-80 6 L-28 -2 L-24 22 L-74 30 Z" fill="#1c1f24" stroke="#0d0e10" stroke-width="2"/><path d="M80 6 L28 -2 L24 22 L74 30 Z" fill="#1c1f24" stroke="#0d0e10" stroke-width="2"/>
      <path d="M-14 28 L14 28 L20 84 L-20 84 Z" fill="#1c1f24" stroke="#0d0e10" stroke-width="2"/>
      <rect x="-52" y="-4" width="20" height="14" rx="3" fill="#30353c"/><rect x="32" y="-4" width="20" height="14" rx="3" fill="#30353c"/>
      <circle r="30" fill="#202328" stroke="#0d0e10" stroke-width="3"/>
      <g fill="#1f5fd6"><rect x="-5" y="-20" width="10" height="40" rx="1"/><rect x="-5" y="-20" width="10" height="40" rx="1" transform="rotate(60)"/><rect x="-5" y="-20" width="10" height="40" rx="1" transform="rotate(-60)"/></g>
      <line y1="-15" y2="15" stroke="#fff" stroke-width="2.2"/><path d="M-3 -10 Q4 -6 -3 -2 Q4 2 -3 6 Q4 10 -3 13" fill="none" stroke="#fff" stroke-width="1.4"/>
      <rect x="-6" y="-88" width="12" height="7" rx="2" fill="#ffcf5a"/></g></svg></div>
    <div class="mir sl"><div class="glass" data-m="0"></div></div><div class="mir sr"><div class="glass" data-m="1"></div></div><div class="mir rv"><div class="glass" data-m="2"></div></div>`;
  const stg=$('stage'); (stg&&stg.parentNode?stg.parentNode:document.body).insertBefore(ck,stg?stg.nextSibling:null);
  const q=id=>ck.querySelector('#'+id), WH=q('ckWh'), N1=q('ckN1'), N2=q('ckN2'), SPD=q('ckSpd'), GEAR=q('ckGear'), STT=q('ckSt'), TAB=q('ckTab'), TG=TAB.getContext('2d'), NUM=q('ckNum'), RAD=q('ckRad');
  const GL=[...ck.querySelectorAll('.glass')];

  // 倒後鏡：三部細鏡頭 → 渲染貼圖 → 鏡面（左右反轉）畫喺鏡框位置
  const mob=matchMedia('(pointer:coarse)').matches;
  const RTS=[[256,168],[256,168],[384,104]].map(([w,h])=>new THREE.WebGLRenderTarget(mob?w*0.75|0:w,mob?h*0.75|0:h,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter}));
  const MC=[new THREE.PerspectiveCamera(26,1.5,0.4,150),new THREE.PerspectiveCamera(26,1.5,0.4,150),new THREE.PerspectiveCamera(24,3.6,0.4,150)];
  const SZ=new THREE.Vector2(), QS=new THREE.Scene(), QC=new THREE.OrthographicCamera(-1,1,1,-1,0,2);
  const qg=new THREE.PlaneGeometry(2,2); { const uv=qg.attributes.uv; for(let i=0;i<uv.count;i++) uv.setX(i,1-uv.getX(i)); }   // 鏡：左右反轉
  const QM=new THREE.MeshBasicMaterial({map:RTS[0].texture,depthTest:false,depthWrite:false,toneMapped:false}); const QUAD=new THREE.Mesh(qg,QM); QUAD.position.z=-1; QUAD.frustumCulled=false; QS.add(QUAD);

  const EYE_H={amb:2.3,police:1.5,taxi:1.42,fire:2.45,bus:2.55};
  function basis(){ const c=S.car, fx=Math.sin(c.a), fz=Math.cos(c.a), lx=Math.cos(c.a), lz=-Math.sin(c.a), eh=typeof ELEV==='function'?ELEV(c.x,c.z):0; return {c,fx,fz,lx,lz,eh}; }
  const active=()=>cur()===3&&(S.mode==='drive'||S.mode==='over')&&!(S.gm==='free'&&typeof FRE!=='undefined'&&FRE.onFoot)&&!(S.gm==='cpr');
  // 車內鏡頭：坐喺右邊駕駛位，望前；拖拉畫面可以轉頭
  function camCock(dt,t,cam,camLook){ const b=basis(), K=VSPEC, D=S.camDrag; camDragTick(dt);
    const fwd=(K.nose||2.6)-0.95, side=-(0.52*(K.kw||1)), y=(EYE_H[K.kind]||2.3)+b.eh;
    const ex=b.c.x+b.fx*fwd+b.lx*side, ez=b.c.z+b.fz*fwd+b.lz*side;
    const sway=Math.max(-0.05,Math.min(0.05,(S.car.v||0)*0.002*(DRV.sgn||0)));
    cam.position.set(ex+b.lx*sway,y+Math.sin(t*9)*Math.min(0.015,Math.abs(S.car.v)*0.0006),ez+b.lz*sway);
    const yaw=Math.max(-1.45,Math.min(1.45,D.yaw)), a=S.car.a+yaw, pit=-0.16-D.pitch*0.35;
    camLook.set(ex+Math.sin(a)*20,y+Math.tan(pit)*20,ez+Math.cos(a)*20); }
  // 收起自己架車（只係主畫面；倒後鏡照見車身）
  let hidden=[];
  function pre(){ const on=active(); if(on!==V.lastCk){ V.lastCk=on; document.body.classList.toggle('ckOn',on); V.rects=null;
      if(!on){ const b=basis(); cam.position.set(b.c.x-b.fx*14,9+b.eh,b.c.z-b.fz*14); } }
    if(!on) return; hidden=[]; amb.traverse(o=>{ if(o.isMesh&&o.visible){ o.visible=false; hidden.push(o); } }); }
  function rects(){ if(V.rects&&V.fr%30) return V.rects; V.rects=GL.map(g=>{ const r=g.getBoundingClientRect(); return r.width>4&&r.height>4?r:null; }); return V.rects; }
  function placeMirror(k,b){ const K=VSPEC, cm=MC[k], fwd=(K.nose||2.6)-0.6, half=1.3*(K.kw||1)+0.32, y=(EYE_H[K.kind]||2.3)-0.25+b.eh;
    if(k<2){ const s=k===0?1:-1, px=b.c.x+b.fx*fwd+b.lx*half*s, pz=b.c.z+b.fz*fwd+b.lz*half*s; cm.position.set(px,y,pz); cm.lookAt(px-b.fx*30+b.lx*s*4.5,y-1.6,pz-b.fz*30+b.lz*s*4.5); }
    else { const back=Math.max(...K.circ.map(Math.abs))+1.25*(K.kl||1), px=b.c.x-b.fx*back, pz=b.c.z-b.fz*back, yy=2.7*(K.kl>1?1.2:1)+b.eh; cm.position.set(px,yy,pz); cm.lookAt(px-b.fx*30,yy-3.2,pz-b.fz*30); } }
  function post(dt,t){ if(!V.lastCk) return; hidden.forEach(o=>o.visible=true); hidden=[]; V.fr++;
    const RR=rects(); const b=basis();
    // 每格只更新一面鏡（輪流），慳效能；陰影唔重新計
    const every=mob?3:1; if(V.fr%every===0){ const k=V.mi=(V.mi+1)%3; if(RR[k]){ placeMirror(k,b); const cm=MC[k], r=RR[k]; const asp=r.width/r.height; if(Math.abs(cm.aspect-asp)>0.01){ cm.aspect=asp; cm.updateProjectionMatrix(); }
        const au=R.shadowMap.autoUpdate; R.shadowMap.autoUpdate=false; R.setRenderTarget(RTS[k]); R.render(scene,cm); R.setRenderTarget(null); R.shadowMap.autoUpdate=au; } }
    const ac=R.autoClear; R.autoClear=false; R.setScissorTest(true); const H=innerHeight;
    RR.forEach((r,k)=>{ if(!r) return; const x=Math.round(r.left+2), y=Math.round(H-r.bottom+2), w=Math.round(r.width-4), h=Math.round(r.height-4); if(w<4||h<4) return;
      R.setViewport(x,y,w,h); R.setScissor(x,y,w,h); QM.map=RTS[k].texture; R.render(QS,QC); });
    R.setScissorTest(false); R.getSize(SZ); R.setViewport(0,0,SZ.x,SZ.y); R.autoClear=ac;
    hud(dt,t); }
  // 儀錶、軚盤、警號板、平板
  let vis=0;
  let wv=0;
  function hud(dt,t){ const c=S.car, K=VSPEC, kmh=Math.abs(c.v||0)*3.6, H=S.hold;
    // 軚盤：寫實揸車跟住拖嘅角度；普通模式跟左右掣（慢慢扭過去、放手回正）
    const w=DRV.wheel!=null?DRV.wheel:((H.R?1:0)-(H.L?1:0))*110; wv+=(w-wv)*Math.min(1,dt*(DRV.wheel!=null?20:6));
    WH.setAttribute('transform','rotate('+wv.toFixed(1)+')');
    N1.setAttribute('transform','rotate('+(-120+Math.min(140,kmh)/140*240).toFixed(1)+')');
    const rpm=0.8+Math.min(1,Math.abs(c.v||0)/Math.max(10,K.vmax))*2.8+(S.hold.G?0.5:0); vis+=(rpm-vis)*Math.min(1,dt*4); N2.setAttribute('transform','rotate('+(-120+Math.min(5,vis)/5*240).toFixed(1)+')');
    if(V.fr%6===0){ SPD.textContent=Math.round(kmh); GEAR.textContent=(typeof DRV!=='undefined'&&DRV.real)?DRV.gear:(c.v<-0.3?'R':'D');
      STT.textContent=S.gm==='ems'||S.gm==='real'||S.simOn?(S.step===1?'STATUS: ENROUTE 出車':S.step===2?'STATUS: AT SCENE 到場':'STATUS: TO HOSP 送院'):'STATUS: MOBILE 巡邏';
      const SH={amb:'A 188',police:'POLICE',fire:'FIRE',taxi:'TAXI',bus:'BUS'}; NUM.textContent=SH[K.kind]||'A 188'; RAD.textContent=K.kind==='amb'?'FSD · A188':'CH1 · '+(SH[K.kind]||'');
      document.body.classList.toggle('ckSir',!!S.siren); ck.classList.toggle('na',K.kind!=='amb'); }
    if(V.fr%3===0) tab(); }
  function tab(){ const W=TAB.width, H=TAB.height, g=TG; g.fillStyle='#0d1116'; g.fillRect(0,0,W,H);
    g.fillStyle='#c62828'; g.fillRect(0,0,W,20); g.fillStyle='#fff'; g.font='bold 12px sans-serif'; g.textBaseline='middle'; g.fillText('A0188 · '+(S.step===1?'前往現場':S.step===3?'送院途中':'行車中'),8,10);
    const mm=$('mini'); if(mm) try{ g.drawImage(mm,6,26,148,148); }catch(e){}
    g.fillStyle='#e8edf3'; g.font='bold 12px sans-serif'; g.textBaseline='top';
    const pl=(S.kase&&S.kase.place)||'', ds=($('hDist')&&$('hDist').textContent)||'';
    const lines=[pl.slice(0,7),pl.slice(7,14),ds&&ds!=='--'?'距離 '+ds:'',S.siren?'🔵 警號開':'']; lines.forEach((s,k)=>{ if(s) g.fillText(s,162,30+k*20); });
    g.fillStyle='#1f6fd6'; g.fillRect(162,H-34,W-170,26); g.fillStyle='#fff'; g.font='bold 12px sans-serif'; g.textBaseline='middle'; g.fillText('導航中',172,H-21); }
  addEventListener('resize',()=>{ V.rects=null; });
  return {get i(){ return cur(); },cycle,active,camCock,pre,post,paint,_V:V};
})();
window.__VIEW=VIEW;

/* ---------- 支援人員到場幫手：救護電單車急救員、消防先遣急救員 ----------
   到場後落車行去病人身邊幫手；離場時電單車急救員跟救護車一齊上車（電單車留喺原地），消防員行返上消防車 */
const HELP=(()=>{ const H=[]; let JC=null;
  function mk(kind){ const p=person('crew'); if(kind==='fire') p.traverse(o=>{ if(!o.material||!o.material.color) return; const h=o.material.color.getHex();
      if(h===C.jacket) o.material.color.setHex(0x1d2a48); else if(h===0x1f4fbf||h===0x183f99) o.material.color.setHex(0xf2c200); });   // 消防：深藍制服、黃頭盔
    p.scale.setScalar(0.92); scene.add(p); return p; }
  function spawn(e){ e.helped=true; const n=e.kind==='fire'?2:1, ps=e.pose; for(let i=0;i<n;i++){ const p=mk(e.kind); const side=i?-1:1, ox=Math.cos(ps.a)*side*1.6, oz=-Math.sin(ps.a)*side*1.6;
      const home=[ps.x+ox,ps.z+oz]; p.position.set(home[0],0.15,home[1]); H.push({e,p,kind:e.kind,i,st:'go',home,x:home[0],z:home[1]}); } }
  function slot(h){ const P=S.kase&&S.kase.loc&&S.kase.loc.patient; if(!P) return [h.x,h.z]; const k=h.kind==='moto'?[-1.5,1.6]:h.i?[1.9,-1.4]:[1.9,1.4]; return [P[0]+k[0],P[1]+k[1]]; }
  function step(h,T,dt,t,sp){ const dx=T[0]-h.x, dz=T[1]-h.z, d=Math.hypot(dx,dz); if(d<0.25){ walk(h.p,t,false); return true; } const m=Math.min(d,sp*dt); h.x+=dx/d*m; h.z+=dz/d*m; h.p.rotation.y=Math.atan2(dx,dz); walk(h.p,t,true,h.i*1.3); h.p.position.set(h.x,0.15,h.z); return false; }
  function tick(dt,t){ if(S.gm!=='ems') return;
    if(S.step<=2) ESC.forEach(e=>{ if(e.kind&&e.kind!=='police'&&e.done&&!e.helped&&e.pose) spawn(e); });
    if(!H.length) return; const loading=S.step>=3||(S.mode==='seq'&&S.seq>=6.6);
    for(const h of H){ if(h.st==='gone') continue;
      if(!loading){ const T=slot(h); if(step(h,T,dt,t,3.0)){ h.st='help'; const P=S.kase.loc.patient; h.p.rotation.y=Math.atan2(P[0]-h.x,P[1]-h.z); h.p.position.y=-0.25; h.p.userData.arms&&h.p.userData.arms.forEach(a=>a.rotation.x=-0.6-Math.sin(t*4+h.i)*0.35); } else h.p.position.y=0.15; continue; }
      h.p.position.y=0.15;
      if(h.kind==='moto'){ // 跟車床一齊行，上救護車
        const tgt=crew.visible?[crew.position.x+Math.cos(crew.rotation.y)*1.4,crew.position.z-Math.sin(crew.rotation.y)*1.4]:[S.car.x-Math.sin(S.car.a)*4.6,S.car.z-Math.cos(S.car.a)*4.6];
        step(h,tgt,dt,t,3.2); if(!crew.visible&&Math.hypot(tgt[0]-h.x,tgt[1]-h.z)<0.6||S.step>=4){ h.st='gone'; h.p.visible=false; } }
      else { if(step(h,h.home,dt,t,2.4)||S.step>=4&&!inView(h.x,h.z,3)){ h.st='gone'; h.p.visible=false; } } } }
  function clear(){ H.forEach(h=>scene.remove(h.p)); H.length=0; }
  window.__HELP=()=>H.map(h=>[h.kind,h.i,h.st,Math.round(h.x),Math.round(h.z),h.p.visible]); return {tick,clear}; })();
/* ======================= 遊戲性：無線電、讓路連擊、三個挑戰、新手教學、突發事件 ======================= */
const PLAY=(()=>{
  const st=document.createElement('style'); st.textContent=`
  #radio{position:fixed;left:50%;top:calc(64px + env(safe-area-inset-top));transform:translateX(-50%) translateY(-8px);z-index:22;max-width:min(560px,86vw);background:#0f1a14e8;color:#d8ffe4;border:1.5px solid #3ccf72;border-radius:10px;padding:6px 12px 7px 10px;font-size:14px;line-height:1.4;opacity:0;transition:opacity .25s,transform .25s;pointer-events:none;box-shadow:0 4px 14px #0006}
  #radio.on{opacity:1;transform:translateX(-50%)}@media (max-width:640px){#radio{top:calc(118px + env(safe-area-inset-top));font-size:13px;left:10px;transform:translateY(-8px);max-width:calc(100vw - 104px)}#radio.on{transform:none}}body.real #radio{top:calc(170px + env(safe-area-inset-top))}#radio b{color:#7dff9a;font-size:11px;letter-spacing:1px;display:block}
  #yCombo{position:fixed;left:50%;top:34%;transform:translate(-50%,-50%) scale(.6);z-index:21;font-weight:900;font-size:30px;color:#fff;text-shadow:0 3px 0 #1f63e0,0 0 18px #3b8bff;opacity:0;pointer-events:none;transition:opacity .2s,transform .25s;white-space:nowrap}
  #yCombo.on{opacity:1;transform:translate(-50%,-50%) scale(1)}#yCombo small{display:block;font-size:15px;text-align:center;color:#cfe3ff;text-shadow:0 1px 0 #0008}
  #coach{position:fixed;left:50%;bottom:calc(132px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:23;width:min(520px,90vw);background:#fffdf3;color:#2a2a2a;border:3px solid #ffb703;border-radius:14px;padding:10px 14px;font-size:16px;line-height:1.45;box-shadow:0 6px 18px #0005;display:none}
  #coach.on{display:block}#coach b{color:#e36414}#coach .pg{float:right;font-size:12px;color:#888}
  .tutPulse{animation:tutP 1s infinite}@keyframes tutP{0%,100%{box-shadow:0 0 0 0 #ffb703cc}50%{box-shadow:0 0 0 12px #ffb70300}}
  #rChal{display:flex;gap:8px;justify-content:center;margin:6px 0 2px;flex-wrap:wrap}#rChal span{border-radius:20px;padding:4px 10px;font-size:13px;font-weight:700;background:#eef1f5;color:#8a93a0}#rChal span.ok{background:#e2f7e8;color:#1b7a3a}
  .chal{margin-left:6px;font-size:12px;letter-spacing:1px}.chal i{font-style:normal;opacity:.25}.chal i.on{opacity:1}`; document.head.append(st);
  const R=document.createElement('div'); R.id='radio'; R.setAttribute('aria-live','polite'); document.body.append(R);
  const Y=document.createElement('div'); Y.id='yCombo'; document.body.append(Y);
  const CO=document.createElement('div'); CO.id='coach'; CO.setAttribute('aria-live','polite'); document.body.append(CO);
  /* ---- 無線電字幕 ---- */
  let rq=[], rt=null;
  function chirp(){ try{ if(!actx) return; const o=actx.createOscillator(), g=actx.createGain(); o.type='square'; o.frequency.setValueAtTime(1400,actx.currentTime); o.frequency.setValueAtTime(1000,actx.currentTime+0.06); g.gain.setValueAtTime(0.03,actx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001,actx.currentTime+0.14); o.connect(g); g.connect(master||actx.destination); o.start(); o.stop(actx.currentTime+0.15); }catch(e){} }
  function radio(msg,who){ rq.push([msg,who||'控制中心']); if(!rt) next(); }
  function next(){ const m=rq.shift(); if(!m){ R.classList.remove('on'); rt=null; return; } R.innerHTML='<b>📻 '+m[1]+'</b>'+m[0]; R.classList.add('on'); chirp(); rt=setTimeout(()=>{ R.classList.remove('on'); rt=setTimeout(next,280); },Math.min(6000,2600+m[0].length*70)); }
  function radioClear(){ rq=[]; clearTimeout(rt); rt=null; R.classList.remove('on'); }
  /* ---- 讓路連擊 ---- */
  let yc=0, yT=0, yHide=null;
  function yieldFx(){ const now=performance.now(); yc=now-yT<6000?yc+1:1; yT=now; S.yieldScore=(S.yieldScore||0)+10*yc; Y.innerHTML='🚑 讓路 ×'+yc+'<small>+'+(10*yc)+' 分 · 多謝讓路！</small>'; Y.classList.add('on'); clearTimeout(yHide); yHide=setTimeout(()=>Y.classList.remove('on'),1400); }
  /* ---- 三個挑戰 ---- */
  const CH=[['🛡️','冇撞車'],['⏱️','兩段準時'],['🧠','全部答啱']];
  function chalNow(){ const nq=2+(S.kase&&S.kase.triage?1:0); return [!S.collided,S.onTime>=2,S.qScore>=nq]; }
  function chalSave(id,c){ const all=store.get('chal',{}); const b=(all[id]||0)|(c[0]?1:0)|(c[1]?2:0)|(c[2]?4:0); all[id]=b; store.set('chal',all); return b; }
  function chalBits(id){ return (store.get('chal',{})[id])||0; }
  function chalHTML(id){ const b=chalBits(id); return '<span class="chal" title="挑戰：冇撞車／兩段準時／全部答啱">'+CH.map((c,i)=>'<i class="'+(b&(1<<i)?'on':'')+'">'+c[0]+'</i>').join('')+'</span>'; }
  function chalResult(){ if(!S.level||S.gm!=='ems'||FUN.on) return; const c=chalNow(); const b=chalSave(S.level.id,c); let el=$('rChal'); if(!el){ el=document.createElement('div'); el.id='rChal'; $('rTime').after(el); }
    el.innerHTML=CH.map((x,i)=>'<span class="'+(c[i]?'ok':'')+'">'+(c[i]?'✅ ':'⬜ ')+x[0]+' '+x[1]+'</span>').join('')+(b===7?'<span class="ok">🏅 三個挑戰全部完成過</span>':''); }
  /* ---- 新手教學 ---- */
  const TUT=[
    {t:'撳住右下角「<b>油</b>」出車（鍵盤 ↑、手掣 RT）。',btn:'bG',done:()=>S.car.v>3},
    {t:'撳「<b>警號</b>」開閃燈同警號，其他車會讓路（鍵盤 H、手掣 X）。',btn:'bH',done:()=>S.siren},
    {t:'用 <b>◀ ▶</b> 轉彎，跟住地上<b>淺橙色線</b>行；路口有<b>藍色「》」</b>指示牌就跟住佢轉。',btn:'bL',done:(T)=>T>9},
    {t:'撳左上角<b>小地圖</b>可以睇大地圖，遊戲會暫停。睇完撳「✕ 繼續」。',btn:'mini',done:(T)=>T>7},
    {t:'記住：冇開警號衝紅燈、撞到人、超時都會扣<b>生命之星</b>（教學模式唔扣）。',done:(T)=>T>7},
    {t:'就到喇！見到<b>橙色圈</b>就停入去，救護員會落車。',done:()=>S.step>=2,wait:()=>S.target&&Math.hypot(S.target[0]-S.car.x,S.target[1]-S.car.z)<90},
    {t:'救護員會問你揀<b>裝備</b>同答<b>急救小測</b>，揀你覺得啱嘅答案。',done:()=>S.step>=4},
    {t:'而家<b>送院</b>：跟住新路線去急症室。轉彎同煞車要慢慢嚟，病人先唔會辛苦。',done:(T)=>T>8},
    {t:'做得好！跟住路線到急症室，停入橙色圈就完成任務。',done:()=>S.step>=5}];
  let ti=-1, tT=0, lastBtn=null;
  function tutStart(){ S.tut=true; ti=0; tT=0; showStep(); }
  function showStep(){ if(lastBtn) lastBtn.classList.remove('tutPulse'); const sp=TUT[ti]; if(!sp){ tutEnd(); return; }
    CO.innerHTML='<span class="pg">新手教學 '+(ti+1)+' / '+TUT.length+'</span>🎓 '+sp.t; CO.classList.add('on'); lastBtn=sp.btn?$(sp.btn):null; if(lastBtn) lastBtn.classList.add('tutPulse'); }
  function tutEnd(){ if(lastBtn) lastBtn.classList.remove('tutPulse'); CO.classList.remove('on'); ti=-1; }
  function tutTick(dt){ if(!S.tut||ti<0) return; const sp=TUT[ti]; if(!sp) return; const vis=(S.mode==='drive'||S.mode==='seq'||S.mode==='hseq')&&!S.quizOpen;
    if(sp.wait&&!sp.wait()){ CO.classList.remove('on'); return; } CO.classList.toggle('on',vis);
    if(S.mode==='drive'||ti>=5) tT+=dt; if(sp.done(tT)){ ti++; tT=0; showStep(); } }
  /* ---- 突發事件：唔讓路嘅私家車、前面交通意外改道 ---- */
  const EV={stub:false,acc:false};
  function evReset(){ EV.stub=Math.random()<0.55; EV.acc=!(S.level&&S.level.works)&&Math.random()<0.35; EV.stubDone=false; EV.accDone=false; }
  function evTick(dt){ if(S.mode!=='drive'||S.gm!=='ems'||S.tut||FUN.on||!S.route||!S.leftDepot) return; const c=S.car;
    const prog=S.route.len?1-Math.hypot(S.target[0]-c.x,S.target[1]-c.z)/Math.max(60,S.route.len):0;
    if(EV.stub&&!EV.stubDone&&S.step===1&&S.siren&&c.v>6){ const fx=Math.sin(c.a), fz=Math.cos(c.a);
      const k=cars.find(k=>k.pose&&!k.stuck&&!k.fly&&(()=>{ const dx=k.pose.x-c.x, dz=k.pose.z-c.z, ah=dx*fx+dz*fz, lat=Math.abs(dx*fz-dz*fx); return ah>22&&ah<55&&lat<3.2&&Math.cos(k.pose.a-c.a)>0.85; })());
      if(k){ EV.stubDone=true; k.stubborn=6; radio('前面有架私家車冇留意警號，小心！可以用對面線小心爬頭，或者等佢讓路。'); } }
    if(EV.acc&&!EV.accDone&&S.step===4&&prog>0.15){ EV.accDone=true; accidentAhead(); } }
  function accidentAhead(){ const c=S.car; const E0=routeEdges(); const E=E0.filter(([a,b])=>{ const A=NODES[a],B=NODES[b], mx=(A[0]+B[0])/2, mz=(A[1]+B[1])/2; return Math.hypot(mx-c.x,mz-c.z)>80&&!inView(mx,mz,6); }); if(!E.length) return 'no edge '+E0.length;
    for(let tries=0;tries<Math.min(6,E.length);tries++){ const [a,b,r]=E[(tries*3+1)%E.length]; if(r.closed) continue; const m0=EVT.meshes.length, c0=EVT.cells.length, len0=S.route.len; closeRoad(a,b,r,'交通意外 請改道'); refreshRoute(true);
      const P=S.route?S.route.path:[]; let bad=false; for(let i=1;i<P.length;i++){ const q=EDGE[P[i-1]+'-'+P[i]]; if(q&&q.closed) bad=true; }
      if(bad||S.route.len>len0*1.8+200){ EVT.meshes.splice(m0).forEach(m=>scene.remove(m)); EVT.cells.splice(c0).forEach(k=>grid[k]&=~2); r.closed=false; CLOSED.splice(CLOSED.indexOf(r),1); refreshRoute(true); continue; }
      hazardCar(a,b,r,0.35,true); hazardCar(a,b,r,0.42,true);
      radio((r.name||'前面')+'發生交通意外，警方封路。已經幫你改道，跟住新路線去醫院。'); S.legLimit+=Math.round((S.route.len-len0)/14)+10; return 'ok'; }
    return 'no detour'; }
  return {radio,radioClear,yieldFx,chalResult,chalHTML,tutStart,tutEnd,tutTick,evReset,evTick,_acc:accidentAhead,_ev:EV};
})();
/* ---------- 遊戲手掣（Gamepad API 標準配置：Xbox／PS／Switch Pro 等） ----------
   揸車：左搖桿或十字鍵左右＝轉彎；RT 或 A＝油；LT 或 B＝煞車／倒車；X＝警號；Y＝大地圖；Start＝選單
   選單／答題：十字鍵或左搖桿移動，A＝確定，B＝關閉地圖或聲明 */
const GP=(()=>{ let prev={}, sel=-1, navT=0, list=[];
  const st=document.createElement('style'); st.textContent='.gpf{outline:4px solid #ffd166!important;outline-offset:3px;box-shadow:0 0 0 7px #ffd16655!important}'; document.head.append(st);
  addEventListener('gamepadconnected',e=>{ toast('🎮 已連接手掣'); });
  addEventListener('gamepaddisconnected',()=>{ ['L','R','G','B'].forEach(k=>S.hold[k]=false); });
  const visible=b=>b&&b.offsetParent!==null&&!b.disabled&&getComputedStyle(b).visibility!=='hidden';
  const LAYERS=['#legalBox','#bigMap.on','#rDisp.on','.gfxAsk','#quiz.show','#over.show','#result.show','#menu.show'];
  function layer(){ for(const q of LAYERS){ const el=document.querySelector(q); if(el&&el.offsetParent!==null||el&&getComputedStyle(el).position==='fixed'&&getComputedStyle(el).display!=='none') return el; } return null; }
  function setSel(i){ list.forEach(b=>b.classList.remove('gpf')); if(!list.length){ sel=-1; return; } sel=(i+list.length)%list.length; const b=list[sel]; b.classList.add('gpf'); b.scrollIntoView({block:'nearest'}); }
  function frame(){ requestAnimationFrame(frame);
    const pads=navigator.getGamepads?navigator.getGamepads():[]; let p=null; for(const g of pads) if(g&&g.connected){ p=g; break; } if(!p) return;
    const B=i=>!!(p.buttons[i]&&(p.buttons[i].pressed||p.buttons[i].value>0.3)), down=i=>B(i)&&!prev[i];
    const ax=p.axes[0]||0, ay=p.axes[1]||0;
    const L=layer(); const driving=!L&&S.mode==='drive'&&!S.quizOpen;
    if(driving){ list.forEach(b=>b.classList.remove('gpf')); list=[]; sel=-1;
      const real=typeof DRV!=='undefined'&&DRV.real; const h={L:!real&&(ax<-0.35)||B(14), R:!real&&(ax>0.35)||B(15), G:B(7)||B(0), B:B(6)||B(1)}; for(const k in h){ if(h[k]!==prev['h'+k]) S.hold[k]=h[k]; prev['h'+k]=h[k]; }
      if(typeof DRV!=='undefined') DRV.pad=real?ax:0;
      if(down(2)) $('bH').click(); if(down(3)){ if(real) DRV.shift(); else if(typeof BIGMAP!=='undefined') BIGMAP.open(); } if(down(8)&&typeof BIGMAP!=='undefined') BIGMAP.open(); if(down(9)) $('bMenu').click(); if(down(4)&&typeof VIEW!=='undefined') VIEW.cycle();   // LB：切換視線
    } else {
      ['L','R','G','B'].forEach(k=>{ if(prev['h'+k]){ S.hold[k]=false; prev['h'+k]=false; } });
      const cand=!L?[]:[...L.querySelectorAll('button')].filter(b=>visible(b)&&!b.closest('.btns,#footBtns,#bMenu,#bAEB')||b.id==='bMenu'||b.id==='bAEB');
      if(cand.length!==list.length||cand.some((b,i)=>b!==list[i])){ list=cand; setSel(Math.max(0,list.indexOf(document.querySelector('.gpf')))); }
      const now=performance.now(); const dir=(B(13)||B(15)||ay>0.5||ax>0.5)?1:(B(12)||B(14)||ay<-0.5||ax<-0.5)?-1:0;
      if(dir&&now>navT){ setSel(sel+dir); navT=now+(prev.dir===dir?140:260); } prev.dir=dir;
      if(down(0)&&list[sel]) list[sel].click();
      if(down(1)){ const x=document.querySelector('#bmX'); if(S.mode==='map'&&x) x.click(); const lx=document.querySelector('#legalBox #lgX'); if(lx&&visible(lx)) lx.click(); }
      if(down(3)&&S.mode==='map'&&typeof BIGMAP!=='undefined') BIGMAP.close();
    }
    for(let i=0;i<p.buttons.length;i++) prev[i]=B(i);
  }
  requestAnimationFrame(frame); return {}; })();
window.__ESC=ESC; window.__PLAY=PLAY;

renderMenu(); show('menu',true); tick();
window.__S=S; window.__ELEV=ELEV; window.__RM=()=>routeMesh; window.__finish=()=>finish(); window.__REAL=REAL; window.__gate=()=>depotGate(); window.__hit=hitBuilding; window.__blk=blockedAt; window.__cell=cellAt; window.__NEON=NEON; window.__MAP=MAP; window.__NODES=NODES; window.__setTarget=setTarget; window.__refreshRoute=refreshRoute; window.__AE=()=>AE; window.__DEPOT=()=>DEPOT; window.__setTOD=setTOD; window.__cars=cars; window.__sg=()=>gain&&gain.gain.value; window.__oc=openChoice; window.__veh=applyLivery; window.__LMK=LMK; window.__fwTest=fireworks; window.__R=R; window.__person=person; window.__peds=peds; window.__store=store; window.__scene=scene; window.__cam=cam; window.__startCase=startCase; window.__peds=peds;

})();