/**Daten für die zu ladenden Knoten und dessen model-geometrien die für die Anwendung zur Verfügung stehen sollen
*@author  Jarek Sarbiewski
*/
var NodeCollectionsData = (function () {
    /**Konstruktor
    *@param  nodeCollectionsXML   Ein XML-Dokument mit allen nodeCollecctions-Daten
    */
    function NodeCollectionsData(nodeCollectionsXML) {
        this.xml$ = $(nodeCollectionsXML);
        var name = this.xml$.find(' nodeCollection[selected]').first().attr('name');
        this.ChangeCollection(name);
    }
    /**Wechselt die Collection und damit die Daten
    *@param  collectionName  Der Name der neuen Collektion
    */
    NodeCollectionsData.prototype.ChangeCollection = function (collectionName) {
        if (this.currCollectionName == collectionName)
            return;
        this.data = [];
        var coll$ = this.xml$.find(' nodeCollection[name=' + collectionName + ']');
        this.nodeImagesPath = coll$.find(' metaData nodeImagesPath').text();
        this.jsonModelsPath = coll$.find(' metaData jsonModelsPath').text();
        this.rootNodeImageFileName = coll$.find(' metaData rootNodeImageFileName').text();
        this.trNodeImageFileName = coll$.find(' metaData trNodeImageFileName').text();
        this.ttNodeImageFileName = coll$.find(' metaData ttNodeImageFileName').text();
        this.tsNodeImageFileName = coll$.find(' metaData tsNodeImageFileName').text();
        var geomNodeSize = coll$.find(' metaData geometryNodeSize').text().split(',');
        var transNodeSize = coll$.find(' metaData transformNodeSize').text().split(',');
        this.geometryNodeSize = new THREE.Vector2(parseInt(geomNodeSize[0]), parseInt(geomNodeSize[1]));
        this.transformNodeSize = new THREE.Vector2(parseInt(transNodeSize[0]), parseInt(transNodeSize[1]));
        var geomNodes$ = coll$.find(' geometryNode');
        for (var i = 0; i < geomNodes$.length; i++) {
            var name = $(geomNodes$[i]).attr('name');
            var title = $(geomNodes$[i]).attr('title');
            var nodeImageFileName = $(geomNodes$[i]).attr('nodeImageFileName');
            var jsonModelFileName = $(geomNodes$[i]).attr('jsonModelFileName');
            this.data.push({
                name: name,
                title: title,
                nodeImageFileName: nodeImageFileName,
                jsonModelFileName: jsonModelFileName
            });
        }
        this.currCollectionName = collectionName;
    };
    /**Gibt ein Array mit allen Namen der GeometryNodes zurück*/
    NodeCollectionsData.prototype.GetGeometryNodeNames = function () {
        var names = [];
        for (var i = 0; i < this.data.length; i++) {
            names.push(this.data[i].name);
        }
        return names;
    };
    /**Gibt ein Array mit allen Titeln der GeometryNodes zurück*/
    NodeCollectionsData.prototype.GetGeometryNodeTitles = function () {
        var titles = [];
        for (var i = 0; i < this.data.length; i++) {
            titles.push(this.data[i].title);
        }
        return titles;
    };
    /**Gibt ein Array mit allen Dateinamen für die Bilder der Geometry-Knoten zurück*/
    NodeCollectionsData.prototype.GetGeometryNodeImageFileNames = function () {
        var names = [];
        for (var i = 0; i < this.data.length; i++) {
            names.push(this.data[i].nodeImageFileName);
        }
        return names;
    };
    /**Gibt ein Array mit allen JSON-Dateinamen für die 3D-Modelle zurück*/
    NodeCollectionsData.prototype.GetJSONModelFileNames = function () {
        var names = [];
        for (var i = 0; i < this.data.length; i++) {
            names.push(this.data[i].jsonModelFileName);
        }
        return names;
    };
    return NodeCollectionsData;
})();
/**Diese Klasse stellt die 3D-Ansicht der Scene-Graphen-Anwendung dar
*@author  Jarek Sarbiewski
*/
var View3D = (function () {
    /** Konstruktor
    *@param  target        Ein HTML-DIV-Element indem die 3D-Darstellung gezeichnet werden soll
    *@param  loadData      Alle Daten für die zu ladenden JSON-3D-Modelle.
    */
    function View3D(target, loadData) {
        var _this = this;
        this.isMouseDown = false;
        this.mouseDownPos = { x: 0, y: 0 };
        this.camZoomPos = 90;
        this.minZoomPos = 30;
        this.maxZoomPos = 300;
        this.camLookPivotY = 0;
        /**Assoziatives Array. Zugriff: modelContainers[id:string]*/
        this.modelContainers = [];
        /**Assoziatives Array. zugriff: models[modelName:string]*/
        this.models = [];
        this.jsonLoader = new THREE.JSONLoader();
        this.loadedModelsCount = 0;
        this.target = target;
        this.loadData = loadData;
        this.cam = new THREE.PerspectiveCamera(50, target.clientWidth / target.clientHeight, 1, 10000);
        this.cam.position.set(0, 0, 90);
        this.camContainer = new THREE.Object3D();
        this.camContainer.rotation.order = "YXZ";
        this.camContainer.rotation.x = -Math.PI / 12;
        this.camContainer.rotation.y = Math.PI / 4;
        this.camContainer.position.set(0, 0, 0);
        this.camContainer.add(this.cam);
        this.keyLight = new THREE.PointLight(0xfffbee, 1.5, 500, 1);
        this.keyLight.position.set(-200, 200, 200);
        this.fillLight = new THREE.PointLight(0xe6f7ff, 1.0, 500, 1);
        this.fillLight.position.set(200, 100, 50);
        this.ambientLight = new THREE.AmbientLight(0x7f7f7f);
        this.scene = new THREE.Scene();
        this.scene.add(this.camContainer);
        this.scene.add(this.keyLight);
        this.scene.add(this.fillLight);
        this.scene.add(this.ambientLight);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setClearColor(new THREE.Color(0x5f7884), 1);
        this.renderer.autoClear = false;
        this.renderer.setSize(target.clientWidth, target.clientHeight);
        target.appendChild(this.renderer.domElement);
        //Skybox
        this.skyboxScene = new THREE.Scene();
        this.skyboxCam = new THREE.PerspectiveCamera(50, target.clientWidth / target.clientHeight, 1, 1000);
        this.skyboxScene.add(this.skyboxCam);
        var path = "images/skybox/";
        var format = '.png';
        var urls = [
            path + 'px' + format, path + 'nx' + format,
            path + 'py' + format, path + 'ny' + format,
            path + 'pz' + format, path + 'nz' + format
        ];
        var skyboxTextureLoader = new THREE.CubeTextureLoader();
        skyboxTextureLoader.load(urls, function (cubeTexture) {
            cubeTexture.mapping = THREE.CubeRefractionMapping;
            var shader = THREE.ShaderLib["cube"];
            shader.uniforms["tCube"].value = cubeTexture;
            var material = new THREE.ShaderMaterial({
                fragmentShader: shader.fragmentShader,
                vertexShader: shader.vertexShader,
                uniforms: shader.uniforms,
                depthWrite: false,
                side: THREE.BackSide
            });
            _this.skybox = new THREE.Mesh(new THREE.CubeGeometry(100, 100, 100), material);
            _this.skyboxScene.add(_this.skybox);
        });
        //GroundGrid
        var geomGridGrey = new THREE.Geometry();
        var geomGridRed = new THREE.Geometry();
        var geomGridBlue = new THREE.Geometry();
        for (var i = -40; i <= 40; i += 4) {
            if (i == 0)
                continue;
            geomGridGrey.vertices.push(new THREE.Vector3(-40, 0, i), new THREE.Vector3(40, 0, i));
            geomGridGrey.vertices.push(new THREE.Vector3(i, 0, -40), new THREE.Vector3(i, 0, 40));
        }
        geomGridRed.vertices.push(new THREE.Vector3(-40, 0, 0), new THREE.Vector3(40, 0, 0));
        geomGridBlue.vertices.push(new THREE.Vector3(0, 0, -40), new THREE.Vector3(0, 0, 40));
        this.scene.add(new THREE.LineSegments(geomGridGrey, new THREE.LineBasicMaterial({ color: 0x434b4e })));
        this.scene.add(new THREE.LineSegments(geomGridRed, new THREE.LineBasicMaterial({ color: 0xea2e45 })));
        this.scene.add(new THREE.LineSegments(geomGridBlue, new THREE.LineBasicMaterial({ color: 0x2893b6 })));
        //Axenkreuz
        this.axis = new THREE.Object3D();
        this.axisScene = new THREE.Scene();
        this.axisScene.add(this.axis);
        var axisLineX = new THREE.Geometry();
        var axisLineY = new THREE.Geometry();
        var axisLineZ = new THREE.Geometry();
        axisLineX.vertices.push(new THREE.Vector3(2, 0, 0), new THREE.Vector3(10, 0, 0));
        axisLineY.vertices.push(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 10, 0));
        axisLineZ.vertices.push(new THREE.Vector3(0, 0, 2), new THREE.Vector3(0, 0, 10));
        this.axis.add(new THREE.LineSegments(axisLineX, new THREE.LineBasicMaterial({ color: 0xea2e45 })));
        this.axis.add(new THREE.LineSegments(axisLineY, new THREE.LineBasicMaterial({ color: 0x00a72a })));
        this.axis.add(new THREE.LineSegments(axisLineZ, new THREE.LineBasicMaterial({ color: 0x2893b6 })));
        var axisArrowX = new THREE.CylinderGeometry(0, 0.75, 3, 16);
        var axisArrowY = new THREE.CylinderGeometry(0, 0.75, 3, 16);
        var axisArrowZ = new THREE.CylinderGeometry(0, 0.75, 3, 16);
        var arrowXMesh = new THREE.Mesh(axisArrowX, new THREE.MeshBasicMaterial({ color: 0xea2e45 }));
        var arrowYMesh = new THREE.Mesh(axisArrowY, new THREE.MeshBasicMaterial({ color: 0x00a72a }));
        var arrowZMesh = new THREE.Mesh(axisArrowZ, new THREE.MeshBasicMaterial({ color: 0x2893b6 }));
        arrowXMesh.rotation.z = -Math.PI / 2;
        arrowXMesh.position.x = 10;
        arrowYMesh.position.y = 10;
        arrowZMesh.rotation.x = Math.PI / 2;
        arrowZMesh.position.z = 10;
        this.axis.add(arrowXMesh);
        this.axis.add(arrowYMesh);
        this.axis.add(arrowZMesh);
        var axisDotGeom = new THREE.SphereGeometry(0.5);
        var axisDotMaterial = new THREE.MeshBasicMaterial({ color: 0xe74d15 });
        this.axis.add(new THREE.Mesh(axisDotGeom, axisDotMaterial));
        this.SetAxisVisibility(false);
        this.InitEvents();
        this.UpdateInterval();
        this.LoadModels();
    }
    /**Läd alle 3D-Models*/
    View3D.prototype.LoadModels = function () {
        var _this = this;
        this.modelNames = this.loadData.GetGeometryNodeNames();
        this.modelFileNames = this.loadData.GetJSONModelFileNames();
        this.modelsPath = this.loadData.jsonModelsPath;
        this.loadedModelsCount = 0;
        for (var i = 0; i < this.modelNames.length; i++) {
            this.models[this.modelNames[i]] = new THREE.Mesh();
        }
        var callback = function (geom, mats) {
            _this.OnLoadModelHandler(geom, mats);
        };
        this.jsonLoader.load(this.modelsPath + this.modelFileNames[this.loadedModelsCount], callback);
    };
    View3D.prototype.OnLoadModelHandler = function (geom, mats) {
        var _this = this;
        var modelName = this.modelNames[this.loadedModelsCount];
        for (var id in this.modelContainers) {
            if (this.modelContainers[id].userData.modelName == modelName) {
                var mesh = this.modelContainers[id].getObjectByName('mesh');
                mesh.geometry = geom;
                mesh.material = new THREE.MultiMaterial(mats);
            }
        }
        this.models[modelName].geometry = geom;
        this.models[modelName].material = new THREE.MultiMaterial(mats);
        this.loadedModelsCount++;
        if (this.loadedModelsCount < this.modelNames.length) {
            var callback = function (geom, mats) {
                _this.OnLoadModelHandler(geom, mats);
            };
            this.jsonLoader.load(this.modelsPath + this.modelFileNames[this.loadedModelsCount], callback);
        }
        else {
            this.SetCamLookPivotY(25);
        }
    };
    /**Initialisiert alle Ereignisse*/
    View3D.prototype.InitEvents = function () {
        var _this = this;
        $(this.target).mousedown(function (e) { _this.MouseDownHandler(e); });
        $(this.target).mouseup(function (e) { _this.MouseUpHandler(e); });
        $(this.target).mouseleave(function (e) { _this.MouseLeaveHandler(e); });
        $(this.target).mousemove(function (e) { _this.MouseMoveHandler(e); });
        $(document).keydown(function (e) { _this.KeyDownHandler(e); });
        if (typeof window.addWheelListener != "undefined") {
            window.addWheelListener(this.target, function (e) { _this.MouseWheelHandler(e); });
        }
    };
    /**Mouse-Down-Handler*/
    View3D.prototype.MouseDownHandler = function (e) {
        this.isMouseDown = true;
        this.mouseDownPos.x = e.offsetX;
        this.mouseDownPos.y = e.offsetY;
        this.mouseDownRotX = this.camContainer.rotation.x;
        this.mouseDownRotY = this.camContainer.rotation.y;
        $(this.target).focus();
    };
    /**Mouse-Up-Handler*/
    View3D.prototype.MouseUpHandler = function (e) {
        this.isMouseDown = false;
    };
    /**Mouse-LeaveHandler*/
    View3D.prototype.MouseLeaveHandler = function (e) {
        this.isMouseDown = false;
    };
    /**Mouse-Move-Handler*/
    View3D.prototype.MouseMoveHandler = function (e) {
        if (this.isMouseDown) {
            var mouseDelta = {
                x: e.offsetX - this.mouseDownPos.x,
                y: e.offsetY - this.mouseDownPos.y
            };
            var rotX = this.mouseDownRotX - mouseDelta.y / 100;
            var rotY = this.mouseDownRotY - mouseDelta.x / 100;
            this.camContainer.rotation.y = rotY;
            if (rotX < Math.PI / 2 && rotX > -Math.PI / 2) {
                this.camContainer.rotation.x = rotX;
            }
            else {
                this.mouseDownPos.y = e.offsetY;
                this.mouseDownRotX = this.camContainer.rotation.x;
            }
        }
    };
    /**Mouse-Wheel-Handler*/
    View3D.prototype.MouseWheelHandler = function (e) {
        this.camZoomPos += (e.deltaY < 0) ? -7 : 7;
        e.preventDefault();
        this.CorrectZoom();
    };
    /**Key-Press-Handler*/
    View3D.prototype.KeyDownHandler = function (e) {
        e.preventDefault();
        if (e.charCode == 119) {
            e.preventDefault();
            this.camZoomPos -= 10;
        }
        else if (e.charCode == 115) {
            e.preventDefault();
            this.camZoomPos += 10;
        }
        this.CorrectZoom();
    };
    /**Korrigiert camZoomPos anhand von min- und maxZoomPos*/
    View3D.prototype.CorrectZoom = function () {
        if (this.camZoomPos < this.minZoomPos)
            this.camZoomPos = this.minZoomPos;
        else if (this.camZoomPos > this.maxZoomPos)
            this.camZoomPos = this.maxZoomPos;
    };
    /**Wird stetig ausgeführt*/
    View3D.prototype.UpdateInterval = function () {
        var _this = this;
        this.cam.position.z += (this.camZoomPos - this.cam.position.z) / 10;
        this.camContainer.position.y += (this.camLookPivotY - this.camContainer.position.y) / 30;
        this.skyboxCam.rotation.copy(this.camContainer.rotation);
        this.Render();
        this.updateIntervalID = window.requestAnimationFrame(function () { return _this.UpdateInterval(); });
    };
    /**Zeichnet die Scene neu*/
    View3D.prototype.Render = function () {
        this.renderer.render(this.skyboxScene, this.skyboxCam);
        this.renderer.render(this.scene, this.cam);
        this.renderer.clearDepth();
        this.renderer.render(this.axisScene, this.cam);
    };
    /**Erstellt eine neue Geometrie aus den vorhandenen 3D-Models und zeigt diese an
    *@param  modelName  Der Name/Typ des zu erstellenden 3D-Models
    *@param  id         Eindeutiger Bezeichner
    */
    View3D.prototype.CreateGeometry = function (modelName, id) {
        if (typeof this.modelContainers[id] != "undefined") {
            this.scene.remove(this.modelContainers[id]);
        }
        var modelContainer = new THREE.Object3D();
        modelContainer.userData = { id: id, modelName: modelName };
        var mesh = this.models[modelName].clone();
        mesh.name = "mesh";
        modelContainer.add(mesh);
        this.modelContainers[id] = modelContainer;
        this.scene.add(this.modelContainers[id]);
    };
    /**Entfernt eine vorher erstellte Geometrie und löscht diese
    *@param  id  Eindeutiger Bezeichner
    */
    View3D.prototype.DeleteGeometry = function (id) {
        if (typeof this.modelContainers[id] != "undefined") {
            this.scene.remove(this.modelContainers[id]);
            delete this.modelContainers[id];
        }
    };
    /**Wechselt die Collection, entfernt die vorhandenen 3D-Objekte und läd alle 3D-Objekte der neuen Collection
    *@param  collectionName  Name der neuen Collection
    */
    View3D.prototype.ChangeCollection = function (collectionName) {
        this.loadData.ChangeCollection(collectionName);
        this.DeleteAllGeometrys();
        this.SetAxisVisibility(false);
        this.LoadModels();
    };
    /**Entfernt alle erstellten Geometrien und löscht diese*/
    View3D.prototype.DeleteAllGeometrys = function () {
        for (var id in this.modelContainers) {
            this.scene.remove(this.modelContainers[id]);
            delete this.modelContainers[id];
        }
    };
    /**Setzt die Position, Rotation und Skalierung einer Geometrie anhand einer Transformations-Matrix
    *@param  geomID  Eindeutiger Bezeichner der Geometrie
    */
    View3D.prototype.SetGeometryMatrix = function (geomID, matrix) {
        this.modelContainers[geomID].matrixAutoUpdate = false;
        this.modelContainers[geomID].matrix.identity();
        this.modelContainers[geomID].applyMatrix(matrix);
    };
    /**Setzt die Position des Drehpunktes der Kamera auf eine bestimmte Höhe(Y)*/
    View3D.prototype.SetCamLookPivotY = function (y) {
        this.camLookPivotY = y;
    };
    /**Setzt die Position, Rotation und Skalierung des Achsenkreuzes anhand einer Transformationsmatrix
    *@param  matrix  Transformationsmatrix
    */
    View3D.prototype.SetAxisMatrix = function (matrix) {
        this.axis.matrixAutoUpdate = false;
        this.axis.matrix.identity();
        this.axis.applyMatrix(matrix.clone());
    };
    /**Setzt die Sichtbarkeit des Achsenkreuzes*/
    View3D.prototype.SetAxisVisibility = function (visible) {
        this.axis.visible = visible;
    };
    return View3D;
})();
/**Scene-Graph-Verbindung
*@author  Jarek Sarbiewski
*/
var SceneGraphConnection = (function () {
    /**Konstruktor
    *@param  id            Eindeutiger Bezeichner
    *@param  ctx           CanvasRenderContext2D indem die Verbindung gezeichnet werden soll
    *@param  renderOffset  Die Verschiebung der Scene-Graph-Fläche
    *@param  state         Status der Verbindung ("incomplete", "active", "activeMove")
    *@param  aNode         Der Knoten am Anfang der Verbindung
    *@param  bNode         Der Knoten am Ende der Verbindung
    */
    function SceneGraphConnection(id, ctx, renderOffset, state, aNode, bNode) {
        if (state === void 0) { state = "incomplete"; }
        this.isSelected = false;
        this.dashOffset = 0;
        this.intervalCounter = 0;
        this.selectedStrokeStyle = "rgba(96, 204, 240, 0.3)";
        this.selectedStrokeAlpha = 0.3;
        this.blinkSwitcher = false;
        this.id = id;
        this.ctx = ctx;
        this.renderOffset = renderOffset;
        this.state = state;
        this.aNode = aNode;
        this.bNode = bNode;
        SceneGraphConnection.highestConnectionID++;
    }
    /**Zeichnet diese Verbindung*/
    SceneGraphConnection.prototype.render = function () {
        var aNodePos = this.aNode.GetPos();
        var bNodePos = this.bNode.GetPos();
        if (this.isSelected) {
            this.ctx.setLineDash([]);
            this.ctx.lineDashOffset = 0;
            this.ctx.lineWidth = 5;
            this.ctx.strokeStyle = this.selectedStrokeStyle;
            this.ctx.beginPath();
            this.ctx.moveTo(aNodePos.x + this.renderOffset.x, aNodePos.y + this.renderOffset.y);
            this.ctx.lineTo(bNodePos.x + this.renderOffset.x, bNodePos.y + this.renderOffset.y);
            this.ctx.stroke();
        }
        if (this.state == SceneGraphConnection.STATE_INCOMPLETE) {
            this.ctx.setLineDash([]);
            this.ctx.lineDashOffset = 0;
            this.ctx.lineWidth = 1;
            this.ctx.strokeStyle = "rgb(170,170,170)";
            this.ctx.beginPath();
            this.ctx.moveTo(aNodePos.x + this.renderOffset.x, aNodePos.y + this.renderOffset.y);
            this.ctx.lineTo(bNodePos.x + this.renderOffset.x, bNodePos.y + this.renderOffset.y);
            this.ctx.stroke();
        }
        else if (this.state == SceneGraphConnection.STATE_ACTIVE) {
            this.ctx.setLineDash([6, 2]);
            this.ctx.lineDashOffset = 0;
            this.ctx.lineWidth = 2;
            this.ctx.strokeStyle = "rgb(89,168,199)";
            this.ctx.beginPath();
            this.ctx.moveTo(aNodePos.x + this.renderOffset.x, aNodePos.y + this.renderOffset.y);
            this.ctx.lineTo(bNodePos.x + this.renderOffset.x, bNodePos.y + this.renderOffset.y);
            this.ctx.stroke();
        }
        else {
            this.dashOffset = (this.dashOffset + 0.2) % 8;
            this.ctx.lineDashOffset = this.dashOffset;
            this.ctx.setLineDash([6, 2]);
            this.ctx.lineWidth = 2;
            this.ctx.strokeStyle = "rgb(96,204,240)";
            this.ctx.beginPath();
            this.ctx.moveTo(aNodePos.x + this.renderOffset.x, aNodePos.y + this.renderOffset.y);
            this.ctx.lineTo(bNodePos.x + this.renderOffset.x, bNodePos.y + this.renderOffset.y);
            this.ctx.stroke();
        }
    };
    /**Selektiert diese Verbindung*/
    SceneGraphConnection.prototype.Select = function () {
        if (this.isSelected)
            return;
        this.isSelected = true;
        this.UpdateInterval();
    };
    /**Deselektiert diese Verbindung*/
    SceneGraphConnection.prototype.Deselect = function () {
        if (!this.isSelected)
            return;
        this.isSelected = false;
        this.StopInterval();
        this.selectedStrokeAlpha = 0.3;
        this.blinkSwitcher = false;
        this.selectedStrokeStyle = "rgba(96, 204, 240, 0.3)";
    };
    /**Setzt A-Knoten*/
    SceneGraphConnection.prototype.SetANode = function (node) {
        this.aNode = node;
    };
    /**Gibt A-Knoten zurück*/
    SceneGraphConnection.prototype.GetANode = function () {
        return this.aNode;
    };
    /**Setzt B-Knoten*/
    SceneGraphConnection.prototype.SetBNode = function (node) {
        this.bNode = node;
    };
    /**Gibt B-Knoten zurück*/
    SceneGraphConnection.prototype.GetBNode = function () {
        return this.bNode;
    };
    /**Gibt Knoten am anderen Ende von der übergebenen Knoten-ID zurück*/
    SceneGraphConnection.prototype.GetOtherNode = function (thisNodeID) {
        if (this.aNode.id == thisNodeID)
            return this.bNode;
        else
            return this.aNode;
    };
    /**Tauscht A- und B-Knoten*/
    SceneGraphConnection.prototype.SwapNodes = function () {
        var aNode = this.aNode;
        this.aNode = this.bNode;
        this.bNode = aNode;
    };
    /**Wird stetig ausgeführt*/
    SceneGraphConnection.prototype.UpdateInterval = function () {
        var _this = this;
        this.intervalCounter++;
        this.updateIntervalID = window.requestAnimationFrame(function () { return _this.UpdateInterval(); });
        if (this.intervalCounter % 31 == 0) {
            if (this.intervalCounter % 2 == 0)
                this.blinkSwitcher = false;
            else
                this.blinkSwitcher = true;
        }
        if (this.blinkSwitcher && this.selectedStrokeAlpha > 0.3)
            this.selectedStrokeAlpha -= 0.1;
        else if (!this.blinkSwitcher && this.selectedStrokeAlpha < 1.0)
            this.selectedStrokeAlpha += 0.1;
        this.selectedStrokeStyle = "rgba(96, 204, 240, " + this.selectedStrokeAlpha + ")";
    };
    /**Stopp das abspielen von UpdateInterval*/
    SceneGraphConnection.prototype.StopInterval = function () {
        window.cancelAnimationFrame(this.updateIntervalID);
    };
    SceneGraphConnection.highestConnectionID = 0;
    SceneGraphConnection.STATE_INCOMPLETE = "incomplete";
    SceneGraphConnection.STATE_ACTIVE = "active";
    SceneGraphConnection.STATE_ACTIVE_MOVE = "activeMove";
    return SceneGraphConnection;
})();
/**Scene-Graph-Knoten
*@author  Jarek Sarbiewski
*/
var SceneGraphNode = (function () {
    /**Konstruktor
    *@param  id            Eindeutiger Bezeichner
    *@param  target        Ziel indem dieser Knoten dargestellt wird
    *@param  renderOffset  Die Verschiebung der Scene-Graph-Fläche
    *@param  type          Typ des Knoten ("geometry", "transformation", "root")
    *@param  name          Der Name des Knoten wie z.B "tr" oder "foot"
    *@param  pos           Logische Position
    *@param  size          Die Breit und die Höhe des Knoten
    *@param  cssImageURL   CSS-Image-URL in der Form "url(...)"
    */
    function SceneGraphNode(id, target, renderOffset, type, name, pos, size, cssImageURL, title) {
        if (title === void 0) { title = "node"; }
        this.isSelected = false;
        this.matrix = new THREE.Matrix4();
        this.matrixX = new THREE.Matrix4();
        this.matrixY = new THREE.Matrix4();
        this.matrixZ = new THREE.Matrix4();
        this.intervalCounter = 0;
        /**Assoziatives Array mit allen benutzten Verbindungen. Zugriff: usedConnections[id:string]*/
        this.usedConnections = [];
        this.id = id;
        this.target = target;
        this.renderOffset = renderOffset;
        this.type = type;
        this.name = name;
        this.pos = pos;
        this.size = size;
        this.cssImageURL = cssImageURL;
        this.zIndex = SceneGraphNode.highestZIndex++;
        //HTML für Knoten erstellen
        $(target).append('<div id="' + id + '" data-nodeType="' + type + '" title="' + title + '"></div>');
        this.htmlNode = $('#' + id).get(0);
        $(this.htmlNode).css({
            "position": "absolute",
            "width": size.x + "px",
            "height": size.y + "px",
            "background-image": cssImageURL,
            "left": (this.pos.x + renderOffset.x - size.x / 2) + "px",
            "top": (this.pos.y + renderOffset.y - size.y / 2) + "px",
            "z-index": this.zIndex,
            "cursor": "pointer",
            "box-sizing": "border-box",
            "background-size": size.x + "px " + size.y + "px",
            "background-repeat": "no-repeat",
            "border-color": "rgba(96,204,240,0)",
            "-moz-transition": "border-color 0.3s",
            "-o-transition": "border-color 0.3s",
            "-webkit-transition": "border-color 0.3s",
            "transition": "border-color 0.3s"
        });
    }
    /**Bringt diesen Knoten in den Vordergrund*/
    SceneGraphNode.prototype.BringToForeground = function () {
        this.zIndex = SceneGraphNode.highestZIndex++;
        $(this.htmlNode).css("z-index", this.zIndex);
    };
    /**Selektiert diesen Knoten*/
    SceneGraphNode.prototype.Select = function () {
        if (this.isSelected)
            return;
        this.isSelected = true;
        $(this.htmlNode).css({
            "border-Radius": (this.type == "transformation") ? "50%" : "17%",
            "border": "4px solid rgba(96,204,240,1)",
            "background-position": "-4px -4px"
        });
        this.UpdateInterval();
    };
    /**Deselektiert diesen Knoten*/
    SceneGraphNode.prototype.Deselect = function () {
        if (!this.isSelected)
            return;
        this.isSelected = false;
        $(this.htmlNode).css({
            "border-Radius": "none",
            "border": "none",
            "border-color": "rgba(96,204,240,0)",
            "background-position": "0 0"
        });
        this.StopInterval();
    };
    /**Setzt die Position
    *@param  pos  Position
    */
    SceneGraphNode.prototype.SetPos = function (pos) {
        this.pos.x = pos.x;
        this.pos.y = pos.y;
        this.htmlNode.style.left = (this.pos.x + this.renderOffset.x - this.size.x / 2) + "px";
        this.htmlNode.style.top = (this.pos.y + this.renderOffset.y - this.size.y / 2) + "px";
        //$(this.htmlNode).css({
        //    "left": (this.pos.x + this.renderOffset.x - this.size.x / 2) + "px",
        //    "top" : (this.pos.y + this.renderOffset.y - this.size.y / 2) + "px"
        //});
    };
    /**Gibt die Position als Referenz zurück*/
    SceneGraphNode.prototype.GetPos = function () {
        return this.pos;
    };
    /**Aktualisiert die Position*/
    SceneGraphNode.prototype.UpdatePos = function () {
        this.SetPos(this.pos);
    };
    /**Überprüft ob dieser Knoten sich mit einen anderen Knoten Verbinden kann*/
    SceneGraphNode.prototype.CanConnectWithNode = function (otherNode) {
        if (this.type == SceneGraphNode.TYPE_GEOMETRY) {
            if (otherNode.type == SceneGraphNode.TYPE_GEOMETRY) {
                return false;
            }
            else if (Object.keys(this.usedConnections).length >= 1) {
                return false;
            }
        }
        if (this.HasGraphCircle(this, otherNode)) {
            return false;
        }
        return true;
    };
    /**Überprüft ob es mit der neuen Verbindung einen Kreis-Zyklus im Graphen gibt
    *@param  thisNode   Der Knoten indem diese Funktion aufgerufen wird
    *@param  otherNode  Der andere Knoten der neuen Verbindung
    */
    SceneGraphNode.prototype.HasGraphCircle = function (thisNode, otherNode) {
        var hasCircle = false;
        if (otherNode.id == thisNode.id)
            return true;
        for (var conID in otherNode.usedConnections) {
            var con = otherNode.usedConnections[conID];
            var aN = con.GetANode();
            var bN = con.GetBNode();
            if ((aN.id == this.id || bN.id == this.id) && !(aN.id == thisNode.id || bN.id == thisNode.id))
                continue;
            if (otherNode.HasGraphCircle(thisNode, con.GetOtherNode(otherNode.id)))
                return true;
        }
        return hasCircle;
    };
    /**Wird stetig ausgeführt*/
    SceneGraphNode.prototype.UpdateInterval = function () {
        var _this = this;
        this.intervalCounter++;
        this.updateIntervalID = window.requestAnimationFrame(function () { return _this.UpdateInterval(); });
        if (this.intervalCounter % 31 == 0) {
            if (this.intervalCounter % 2 == 0)
                $(this.htmlNode).css("border-color", "rgba(96,204,240,1)");
            else
                $(this.htmlNode).css("border-color", "rgba(96,204,240,0.3)");
        }
    };
    /**Stopp das abspielen von UpdateInterval*/
    SceneGraphNode.prototype.StopInterval = function () {
        window.cancelAnimationFrame(this.updateIntervalID);
    };
    SceneGraphNode.highestZIndex = 10;
    SceneGraphNode.TYPE_GEOMETRY = "geometry";
    SceneGraphNode.TYPE_TRANSFORMATION = "transformation";
    SceneGraphNode.TYPE_ROOT = "root";
    return SceneGraphNode;
})();
/**
*@author Jarek Sarbiewski
*/
var NodeSettings = (function () {
    /**Konstruktor
    *@param  target  Ein DIV-Element indem die Knoten-Einstellungen dargestellt werden sollen
    *@param  mode    Modus (translation, rotation, scale)
    */
    function NodeSettings(target, mode) {
        if (mode === void 0) { mode = NodeSettings.MODE_TRANSLATION; }
        this.matrix = new THREE.Matrix4();
        this.matrixX = new THREE.Matrix4();
        this.matrixY = new THREE.Matrix4();
        this.matrixZ = new THREE.Matrix4();
        this.isHide = false;
        this.isDisable = true;
        /**Wird ausgeführt wenn sich in den Knoten-Einstellungen was geändert hat
        *@param  matrixX  Matrix bzgl. der X-Achse
        *@param  matrixY  Matrix bzgl. der Y-Achse
        *@param  matrixZ  Matrix bzgl. der Z-Achse
        *@param  matrix   Die Gesamtmatrix (Multiplikation von matriX * matrixY * matrixZ)
        *@param  mode     Transformationsmodus
        */
        this.onChange = function (matrixX, matrixY, matrixZ, matrix, mode) { };
        this.target = target;
        this.mode = mode;
        this.Init();
        this.InitEvents();
    }
    /**Initialisierung*/
    NodeSettings.prototype.Init = function () {
        $(this.target).css({ "overflow": "hidden", "border-bottom": "1px solid #ccc", "margin-bottom": "20px" });
        $(this.target).append('<p><em id="nodeSettingsLabel"></em></p>');
        var label = $('#nodeSettingsLabel');
        //Slider-Labels
        $(this.target).append('<div id="sliderLabels"></div>');
        $('#sliderLabels').css({
            "font-size": "14px",
            "line-height": "24px",
            "padding-right": "15px",
            "padding-top": "24px",
            "float": "left",
            "opacity": "0.5"
        });
        $('#sliderLabels').append('<span id="sliderLabelX"></span><br />');
        $('#sliderLabels').append('<span id="sliderLabelY"></span><br />');
        $('#sliderLabels').append('<span id="sliderLabelZ"></span>');
        var sliderLabelX = $('#sliderLabelX');
        var sliderLabelY = $('#sliderLabelY');
        var sliderLabelZ = $('#sliderLabelZ');
        sliderLabelX.css({ "color": "#ea233b" });
        sliderLabelY.css({ "color": "#008a22" });
        sliderLabelZ.css({ "color": "#3a839c" });
        //Sliders
        $(this.target).append('<div id="sliders"></div>');
        var sliders = $('#sliders');
        sliders.css({
            "width": "406px",
            "height": "96px",
            "float": "left",
            "opacity": "0.5"
        });
        sliders.append('<div id="rangeValues"></div>');
        sliders.append('<div id="sliderX" class="slider" data-axis="x"></div>');
        sliders.append('<div id="sliderY" class="slider" data-axis="y"></div>');
        sliders.append('<div id="sliderZ" class="slider" data-axis="z"></div>');
        $(this.target).find('div.slider, #rangeValues').css({
            "width": "406px",
            "height": "24px",
            "position": "relative"
        });
        $(this.target).find('div.slider').css({
            "background-image": "url('images/sliderBG.png')",
            "repeat": "no-repeat"
        });
        var rangeValues = $(this.target).find('#rangeValues');
        var sliderX = $(this.target).find('#sliderX');
        var sliderY = $(this.target).find('#sliderY');
        var sliderZ = $(this.target).find('#sliderZ');
        var rangeValue = $('<div class="rangeValue"></div>');
        var sliderButton = $('<div class="sliderButton"></div>');
        rangeValue.css({
            "width": "60px",
            "height": "18px",
            "position": "absolute",
            "top": "6px",
            "font-size": "13px",
            "color": "#686868",
            "text-align": "center"
        });
        rangeValues.append(rangeValue.clone().attr('id', 'rangeValueMin').css({ "left": "-6px " }));
        rangeValues.append(rangeValue.clone().attr('id', 'rangeValueMid').css({ "left": "174px" }));
        rangeValues.append(rangeValue.clone().attr('id', 'rangeValueMax').css({ "left": "354px" }));
        sliderButton.css({
            "width": "46px",
            "height": "16px",
            "position": "absolute",
            "top": "4px",
            "left": "180px",
            "background-image": "url('images/slider.png')",
            "background-position": "0 0",
            "cursor": "default"
        });
        sliderX.append(sliderButton.clone().attr({ 'id': 'sliderButtonX', 'data-axis': 'x' }));
        sliderY.append(sliderButton.clone().attr({ 'id': 'sliderButtonY', 'data-axis': 'y' }));
        sliderZ.append(sliderButton.clone().attr({ 'id': 'sliderButtonZ', 'data-axis': 'z' }));
        //Curr-Values
        $(this.target).append('<div id="currValues"></div>');
        $('#currValues').css({
            "width": "50px",
            "font-size": "13px",
            "line-height": "24px",
            "padding": "23px 0 1px 0",
            "float": "left",
            "text-align": "right",
            "opacity": "0.5"
        });
        $('#currValues').append('<span id="currValueX" class="currValue"></span><br />');
        $('#currValues').append('<span id="currValueY" class="currValue"></span><br />');
        $('#currValues').append('<span id="currValueZ" class="currValue"></span>');
        $('#currValues .currValue').css({
            "color": "#686868",
            "font-size": "13px"
        });
        //Voreinstellungen
        var min;
        var mid;
        var max;
        var currVal;
        if (this.mode == NodeSettings.MODE_TRANSLATION) {
            label.empty().append('Translation-Transform');
            sliderLabelX.append('Translation-X');
            sliderLabelY.append('Translation-Y');
            sliderLabelZ.append('Translation-Z');
            min = "-40";
            mid = "0";
            max = "40";
            currVal = "0.0";
        }
        else if (this.mode == NodeSettings.MODE_ROTATION) {
            label.empty().append('Rotation-Transform');
            sliderLabelX.append('Rotation-X');
            sliderLabelY.append('Rotation-Y');
            sliderLabelZ.append('Rotation-Z');
            min = "-180°";
            mid = "0°";
            max = "180°";
            currVal = "0.0°";
        }
        else {
            label.empty().append('Scale-Transform');
            sliderLabelX.append('Scale-X');
            sliderLabelY.append('Scale-Y');
            sliderLabelZ.append('Scale-Z');
            min = "10%";
            mid = "100%";
            max = "190%";
            currVal = "100.0%";
        }
        $('#rangeValues #rangeValueMin').empty().append(min);
        $('#rangeValues #rangeValueMid').empty().append(mid);
        $('#rangeValues #rangeValueMax').empty().append(max);
        $('#currValues .currValue').empty().append(currVal);
    };
    /**Initialisiert alle Events*/
    NodeSettings.prototype.InitEvents = function () {
        var _this = this;
        $(this.target).find(' .sliderButton').mousedown(function (e) {
            _this.MouseDownOnSliderButtonHandler(e);
        });
    };
    /**Mouse-Down auf ein Slider-Button*/
    NodeSettings.prototype.MouseDownOnSliderButtonHandler = function (e) {
        var _this = this;
        if (this.isDisable)
            return;
        e.preventDefault();
        $(e.delegateTarget).css("background-position", "-46px 0");
        var data = {
            button: e.delegateTarget,
            downCursorX: e.pageX,
            downButtonLeft: parseFloat($(e.delegateTarget).css('left'))
        };
        $(this.target).parent().mousemove(data, function (e) { _this.MouseMoveOnSlidersHandler(e); });
        $(this.target).parent().mouseup(data, function (e) { _this.MouseUpOnSlidersHandler(e); });
        $(this.target).parent().mouseleave(data, function (e) { _this.MouseLeaveOnSlidersHandler(e); });
    };
    /**Mouse-Move auf Sliders*/
    NodeSettings.prototype.MouseMoveOnSlidersHandler = function (e) {
        e.preventDefault();
        var deltaX = e.pageX - e.data.downCursorX;
        var newLeft = e.data.downButtonLeft + deltaX;
        if (newLeft < 0)
            newLeft = 0;
        else if (newLeft > 360)
            newLeft = 360;
        $(e.data.button).css("left", newLeft + "px");
        var currVal;
        var unit;
        if (this.mode == NodeSettings.MODE_TRANSLATION) {
            currVal = Math.round((newLeft - 180) * 0.222222222 * 10) / 10;
            unit = "";
        }
        else if (this.mode == NodeSettings.MODE_ROTATION) {
            currVal = Math.round((newLeft - 180) * 10) / 10;
            unit = "°";
        }
        else {
            currVal = Math.round((newLeft - 180) * 0.5 * 10 + 1000) / 10;
            unit = "%";
        }
        var axis = $(e.data.button).attr('data-axis');
        if (axis == "x") {
            this.xVal = currVal;
            $('#currValues #currValueX').empty().append(currVal.toFixed(1) + unit);
        }
        else if (axis == "y") {
            this.yVal = currVal;
            $('#currValues #currValueY').empty().append(currVal.toFixed(1) + unit);
        }
        else {
            this.zVal = currVal;
            $('#currValues #currValueZ').empty().append(currVal.toFixed(1) + unit);
        }
        this.UpdateMatrices();
        this.onChange(this.matrixX.clone(), this.matrixY.clone(), this.matrixZ.clone(), this.matrix.clone(), this.mode);
    };
    /**Mouse-Up auf Sliders*/
    NodeSettings.prototype.MouseUpOnSlidersHandler = function (e) {
        e.preventDefault();
        $(e.delegateTarget).off('mouseup mousemove mouseleave');
        $(e.data.button).css("background-position", "0 0");
    };
    /**Mouse-Leave auf Sliders*/
    NodeSettings.prototype.MouseLeaveOnSlidersHandler = function (e) {
        e.preventDefault();
        $(e.delegateTarget).off('mouseup mousemove mouseleave');
        $(e.data.button).css("background-position", "0 0");
    };
    /**Aktualisiert die Matrizen anhand von x-, y- und z-Val*/
    NodeSettings.prototype.UpdateMatrices = function () {
        var x;
        var y;
        var z;
        if (this.mode == NodeSettings.MODE_TRANSLATION) {
            this.matrixX.makeTranslation(this.xVal, 0, 0);
            this.matrixY.makeTranslation(0, this.yVal, 0);
            this.matrixZ.makeTranslation(0, 0, this.zVal);
            this.matrix.makeTranslation(this.xVal, this.yVal, this.zVal);
        }
        else if (this.mode == NodeSettings.MODE_ROTATION) {
            this.matrixX.makeRotationX(this.xVal / 180 * Math.PI);
            this.matrixY.makeRotationY(this.yVal / 180 * Math.PI);
            this.matrixZ.makeRotationZ(this.zVal / 180 * Math.PI);
            this.matrix.identity();
            this.matrix.multiplyMatrices(this.matrix, this.matrixX);
            this.matrix.multiplyMatrices(this.matrix, this.matrixY);
            this.matrix.multiplyMatrices(this.matrix, this.matrixZ);
        }
        else {
            x = this.xVal / 100;
            y = this.yVal / 100;
            z = this.zVal / 100;
            this.matrixX.makeScale(x, 1, 1);
            this.matrixY.makeScale(1, y, 1);
            this.matrixZ.makeScale(1, 1, z);
            this.matrix.makeScale(x, y, z);
        }
    };
    /**Zeigt die Knoten-Einstellungen an falls diese vorher versteckt war*/
    NodeSettings.prototype.Show = function () {
        if (this.isHide) {
            $(this.target).slideDown('fast');
            this.isHide = false;
        }
    };
    /**Versteckt diese Knoten-Einstellungen falls diese vorher sichtbar war*/
    NodeSettings.prototype.Hide = function () {
        if (!this.isHide) {
            $(this.target).slideUp('fast');
            this.isHide = true;
        }
    };
    /**Aktiviert die Slider*/
    NodeSettings.prototype.Enable = function () {
        if (this.isDisable) {
            $(this.target).find(' #sliderLabels').css("opacity", "1");
            $(this.target).find(' #currValues').css("opacity", "1");
            $(this.target).find(' #sliders').css("opacity", "1");
            $(this.target).find(' .sliderButton').css("cursor", "pointer");
            this.isDisable = false;
        }
    };
    /**Deaktiviert die Slider*/
    NodeSettings.prototype.Disable = function () {
        if (!this.isDisable) {
            $(this.target).find(' #sliderLabels').css("opacity", "0.5");
            $(this.target).find(' #currValues').css("opacity", "0.5");
            $(this.target).find(' #sliders').css("opacity", "0.5");
            $(this.target).find(' .sliderButton').css("cursor", "default");
            this.isDisable = true;
        }
    };
    /**Richtet die Werte anhand von Matrizen ein und ändert evtl. den Transformations-Modus*/
    NodeSettings.prototype.SettingUp = function (matX, matY, matZ, mode) {
        this.matrixX = matX.clone();
        this.matrixY = matY.clone();
        this.matrixZ = matZ.clone();
        this.matrix.identity();
        this.matrix.multiplyMatrices(this.matrix, matX);
        this.matrix.multiplyMatrices(this.matrix, matY);
        this.matrix.multiplyMatrices(this.matrix, matZ);
        var min;
        var mid;
        var max;
        var newLeftX;
        var newLeftY;
        var newLeftZ;
        var sliderLabel;
        var currVal;
        var unit;
        var label = $(this.target).find(' #nodeSettingsLabel');
        if (mode == NodeSettings.MODE_TRANSLATION) {
            this.xVal = matX.elements[12];
            this.yVal = matY.elements[13];
            this.zVal = matZ.elements[14];
            unit = "";
            sliderLabel = "Translation";
            min = "-40";
            mid = "0";
            max = "40";
            label.empty().append('Translation-Transform');
            newLeftX = (this.xVal * 4.5 + 180).toFixed(1) + "px";
            newLeftY = (this.yVal * 4.5 + 180).toFixed(1) + "px";
            newLeftZ = (this.zVal * 4.5 + 180).toFixed(1) + "px";
        }
        else if (mode == NodeSettings.MODE_ROTATION) {
            this.xVal = Math.round((Math.atan2(matX.elements[9], matX.elements[5]) / -Math.PI * 180) * 10) / 10;
            this.yVal = Math.round((Math.atan2(matY.elements[2], matY.elements[0]) / -Math.PI * 180) * 10) / 10;
            this.zVal = Math.round((Math.atan2(matZ.elements[4], matZ.elements[0]) / -Math.PI * 180) * 10) / 10;
            unit = "°";
            sliderLabel = "Rotation";
            min = "-180°";
            mid = "0°";
            max = "180°";
            label.empty().append('Rotation-Transform');
            newLeftX = (this.xVal + 180).toFixed(1) + "px";
            newLeftY = (this.yVal + 180).toFixed(1) + "px";
            newLeftZ = (this.zVal + 180).toFixed(1) + "px";
        }
        else {
            this.xVal = matX.elements[0] * 100;
            this.yVal = matY.elements[5] * 100;
            this.zVal = matZ.elements[10] * 100;
            unit = "%";
            sliderLabel = "Scale";
            min = "10%";
            mid = "100%";
            max = "190%";
            label.empty().append('Scale-Transform');
            newLeftX = (this.xVal * 2 - 20).toFixed(1) + "px";
            newLeftY = (this.yVal * 2 - 20).toFixed(1) + "px";
            newLeftZ = (this.zVal * 2 - 20).toFixed(1) + "px";
        }
        if (this.mode != mode) {
            $(this.target).find(' #sliderLabelX').empty().append(sliderLabel + "-X");
            $(this.target).find(' #sliderLabelY').empty().append(sliderLabel + "-Y");
            $(this.target).find(' #sliderLabelZ').empty().append(sliderLabel + "-Z");
            $(this.target).find(' #rangeValueMin').empty().append(min);
            $(this.target).find(' #rangeValueMid').empty().append(mid);
            $(this.target).find(' #rangeValueMax').empty().append(max);
            this.mode = mode;
        }
        $(this.target).find(' #currValueX').empty().append(this.xVal.toFixed(1) + unit);
        $(this.target).find(' #currValueY').empty().append(this.yVal.toFixed(1) + unit);
        $(this.target).find(' #currValueZ').empty().append(this.zVal.toFixed(1) + unit);
        $(this.target).find(' #sliderButtonX').css("left", newLeftX);
        $(this.target).find(' #sliderButtonY').css("left", newLeftY);
        $(this.target).find(' #sliderButtonZ').css("left", newLeftZ);
        this.onChange(this.matrixX.clone(), this.matrixY.clone(), this.matrixZ.clone(), this.matrix.clone(), this.mode);
    };
    NodeSettings.MODE_TRANSLATION = "tt";
    NodeSettings.MODE_ROTATION = "tr";
    NodeSettings.MODE_SCALE = "ts";
    return NodeSettings;
})();
/**Diese Klasse stellt den eigentlichen Scene-Graphen der Anwendung dar
*@author  Jarek Sarbiewski
*/
var SceneGraph = (function () {
    /**Konstruktor
    *@param  target    Ein HTML-Div-Container indem der SceneGraph angezeigt werden soll
    *@param  loadData  Daten mit den zu ladenden Bildern für die Knoten
    *@param  mode      Interaktionsmodus der Knoten. "moveNode" oder "createConnection". Default:"moveNode"
    */
    function SceneGraph(target, loadData, mode) {
        var _this = this;
        if (mode === void 0) { mode = "moveNode"; }
        this.intervalCounter = 0;
        this.renderOffset = new THREE.Vector2(0, 0);
        this.renderOffsetAtMouseDown = new THREE.Vector2(0, 0);
        this.isNodeCollectionHide = true;
        /**Assoziatives Array aller Knoten. Zugriff: nodes[nodeID:string]*/
        this.nodes = [];
        /**Assoziatives Array aller Verbindungen. Zugriff: connections[connectionID:string]*/
        this.connections = [];
        this.canvasMouseState = "up";
        this.underCursorConID = "";
        /**Wird ausgeführt wenn ein neuer Geometrie-Knoten erstellt worden ist
        *@param  id        Eindeutiger Bezeichner des Knoten
        *@param  nodeName  Der Name des Knoten wie z.B. "tr", "foot" etc.*/
        this.onCreateGeometryNode = function (nodeName, id) { };
        /**Wird ausgeführt wenn eine neue Verbindung erstellt worden ist*/
        this.onCreateConnection = function () { };
        /**Wird ausgeführt wenn ein Transformations-Knoten selektiert wird
        *@param  matrixX    X-Matrix
        *@param  matrixY    Y-Matrix
        *@param  matrixZ    Z-Matrix
        *@param  matrix     Gesamt-Matrix (Multiplikation von matrixX * matrixY * matrixZ)
        *@param  transType  Transformations-Typ ("tt", "tr", "ts");*/
        this.onSelectTransformationNode = function (matrixX, matrixY, matrixZ, matrix, transType) { };
        /**Wird ausgeführt wenn ein Geometrie-Knoten selektiert wird
        *@param  matrices    Ein Matrizen-Array mit allen Transformations-Matrizen den dieser Knoten durchläuft
        *@param  geomNodeID  Die ID des Geometrie-Knoten*/
        this.onSelectGeometryNode = function (matrices, geomNodeID) { };
        /**Wird ausgeführt wenn der Wurzel-Knoten selektiert wird*/
        this.onSelectRootNode = function () { };
        /**Wird ausgeführt wenn eine Verbindung selektiert wird*/
        this.onSelectConnection = function () { };
        /**Wird ausgeführt wenn ein Geometrie-Knoten gelöscht wird
           HINWEIS: Falls eine Verbindung des Geometrie-Knoten mitgelöscht wird,
                    wird das Event onDeleteTransNodeOrConnection() NICHT ausgelöst
        *@param  geomNodeID  Die ID des gelöschten Geometrie-Knotens*/
        this.onDeleteGeometryNode = function (geomNodeID) { };
        /**Wird ausgeführt wenn ein Transformations-Knoten oder eine Verbindung gelöscht wird*/
        this.onDeleteTransNodeOrConnection = function () { };
        this.target = target;
        this.loadData = loadData;
        this.mode = mode;
        $(target).css({ "position": "relative", "overflow": "hidden" });
        //Node-Collection
        $(target).append('<div id="nodeCollection"></div>');
        this.nodeCollection = document.getElementById('nodeCollection');
        $(this.nodeCollection).css({
            "position": "absolute",
            "right": Math.round((target.clientWidth - target.clientWidth * .66) / 2),
            "top": "0",
            "z-index": "100000",
            "width": Math.round(target.clientWidth * .66),
            "background-color": "#fff",
            "padding": "20px 20px 10px 20px",
            "border-bottom": "2px solid #bbb",
            "border-left": "1px solid #dfdfdf",
            "border-right": "1px solid #dfdfdf",
            "-moz-box-sizing": "border-box",
            "-webkit-box-sizing": "border-box",
            "box-sizing": "border-box"
        });
        $(this.nodeCollection).append('<div id="nodeCollectionCloseButton" style="float:right; ' +
            'cursor:pointer; border:3px solid #666; border-radius:50%; ' +
            'width:20px; height:20px; background:url(\'images/iconClose.gif\'), #fff"></div>' +
            '<h1 style="color:#666; padding-bottom:10px">Node-Collection</h1>' +
            '<p><em style="color:#666; font-size:14px">Geometry-Nodes</em></p>' +
            '<div id="geomNodeCollectionContainer" style="overflow:hidden"></div>' +
            '<br /><p><em style="color:#666; font-size:14px">Transformation-Nodes</em></p>' +
            '<div id="transNodeCollectionContainer" style="overflow: hidden; margin-bottom:10px"></div>');
        this.geomNodeCollectionContainer$ = $(this.target).find(' #nodeCollection #geomNodeCollectionContainer');
        this.transNodeCollectionContainer$ = $(this.target).find(' #nodeCollection #transNodeCollectionContainer');
        $(this.nodeCollection).hide();
        $('#nodeCollectionCloseButton').click(function () { return _this.SwitchNodeCollectionVisibility(); });
        this.ChangeCollection(this.loadData.currCollectionName);
        //Canvas
        $(target).append('<canvas id="sceneGraphCanvas" ' +
            'width="' + target.clientWidth + '" ' +
            'height="' + target.clientHeight + '"></canvas>');
        this.canvas = document.getElementById("sceneGraphCanvas");
        $(this.canvas).css({
            "position": "absolute",
            "left": "0",
            "top": "0",
            "z-index": 0,
            "cursor": "move"
        });
        this.ctx = this.canvas.getContext("2d");
        this.ctx.fillStyle = "rgb(248,248,248)";
        //Root-Node (World)
        //this.CreateNode("world", SceneGraphNode.TYPE_ROOT, new THREE.Vector2(214, 40));
        this.InitEvents();
        this.UpdateInterval();
    }
    /**Initialisiert alle Ereignisse*/
    SceneGraph.prototype.InitEvents = function () {
        var _this = this;
        for (var id in this.nodes) {
            $(this.nodes[id].htmlNode).mousedown(function (e) { _this.MouseDownOnNodeHandler(e); });
            $(this.nodes[id].htmlNode).mouseenter(function (e) { _this.MouseEnterOnNodeHandler(e); });
            $(this.nodes[id].htmlNode).mouseleave(function (e) { _this.MouseLeaveOnNodeHandler(e); });
        }
        $(document).keydown(function (e) { _this.KeyDownHandler(e); });
        this.InitCanvasEvents();
    };
    /**Initialisiert Canvas-Events*/
    SceneGraph.prototype.InitCanvasEvents = function () {
        var _this = this;
        $(this.canvas).css("cursor", "move");
        $(this.canvas).mousedown(function (e) { _this.MouseDownOnCanvasHandler(e); });
        $(this.canvas).mouseup(function (e) { _this.MouseUpOnCanvasHandler(e); });
        $(this.canvas).mousemove(function (e) { _this.MouseMoveOnCanvasHandler(e); });
    };
    /**Entfernt Canvas-Events*/
    SceneGraph.prototype.RemoveCanvasEvents = function () {
        $(this.canvas).css("cursor", "default");
        $(this.canvas).off("mousedown mousemove mouseup");
    };
    /**Mouse-Down auf Canvas*/
    SceneGraph.prototype.MouseDownOnCanvasHandler = function (e) {
        this.cursorPosAtCanvasDown = new THREE.Vector2(e.offsetX, e.offsetY);
        this.renderOffsetAtMouseDown = this.renderOffset.clone();
        this.canvasMouseState = "down";
    };
    /**Mouse-Up auf Canvas*/
    SceneGraph.prototype.MouseUpOnCanvasHandler = function (e) {
        this.canvasMouseState = "up";
        e.preventDefault();
        var deltaMove = Math.sqrt(Math.pow((e.offsetX - this.cursorPosAtCanvasDown.x), 2) +
            Math.pow((e.offsetY - this.cursorPosAtCanvasDown.y), 2));
        if (deltaMove < 5 && this.underCursorConID != "") {
            //Click auf Connection
            if (typeof this.selectedConnectionID != "undefined") {
                this.connections[this.selectedConnectionID].Deselect();
                delete this.selectedConnectionID;
            }
            if (typeof this.selectedNodeID != "undefined") {
                this.nodes[this.selectedNodeID].Deselect();
                delete this.selectedNodeID;
            }
            this.connections[this.underCursorConID].Select();
            this.selectedConnectionID = this.underCursorConID;
            this.CorrectConnections();
            this.onSelectConnection();
        }
    };
    /**Mouse-Move auf Canvas*/
    SceneGraph.prototype.MouseMoveOnCanvasHandler = function (e) {
        if (this.canvasMouseState == "up") {
            this.underCursorConID = this.GetConnectionUnderCursor(e.offsetX, e.offsetY);
            if (this.underCursorConID != "")
                $(this.canvas).css("cursor", "pointer");
            else
                $(this.canvas).css("cursor", "move");
        }
        else if (this.canvasMouseState == "down") {
            var deltaMove = new THREE.Vector2(e.offsetX - this.cursorPosAtCanvasDown.x, e.offsetY - this.cursorPosAtCanvasDown.y);
            this.renderOffset.x = this.renderOffsetAtMouseDown.x + deltaMove.x;
            this.renderOffset.y = this.renderOffsetAtMouseDown.y + deltaMove.y;
            for (var nodeID in this.nodes)
                this.nodes[nodeID].UpdatePos();
        }
    };
    /**Key-Press-Handler*/
    SceneGraph.prototype.KeyDownHandler = function (e) {
        e.preventDefault();
        if (e.keyCode == 46) {
            this.DeleteSelectedElement();
        }
    };
    /**Überprüft was für eine Verbindung sich unter dem Cursor befindet und gibt dessen ID zurück
    *@param  cursorPosX  Die X-Position des Cursors relativ zum Canvas
    *@param  cursorPosY  Die Y-Position des Cursors relativ zum Canvas
    *@return  Die Verbindungs-ID unter Cursor oder "" falls nicht gefunden
    */
    SceneGraph.prototype.GetConnectionUnderCursor = function (cursorPosX, cursorPosY) {
        var cursorPos = new THREE.Vector2(cursorPosX - this.renderOffset.x, cursorPosY - this.renderOffset.y);
        for (var conID in this.connections) {
            var p = cursorPos.clone();
            var a = this.connections[conID].GetANode().GetPos().clone();
            var b = this.connections[conID].GetBNode().GetPos().clone();
            var c = a.clone().subVectors(b, a);
            var h = c.length();
            var g = b.y - a.y;
            var angle;
            try {
                angle = Math.asin(g / h);
            }
            catch (e) {
                angle = 0;
            }
            if (a.x > b.x)
                angle = Math.PI - angle;
            b.rotateAround(a, -angle);
            p.rotateAround(a, -angle);
            if (p.x > Math.min(a.x, b.x) && p.x < Math.max(a.x, b.x)) {
                if (Math.abs(p.y - a.y) < 8)
                    return conID;
            }
        }
        return "";
    };
    /**Mouse-Down auf einen collectionNode*/
    SceneGraph.prototype.MouseDownOnCollectionNodeHandler = function (e) {
        var _this = this;
        //this.SwitchNodeCollectionVisibility();
        e.preventDefault();
        var dragNode = $(e.delegateTarget).clone();
        var docPos = $(e.delegateTarget).offset();
        this.dragNodeOffset = new THREE.Vector2(e.offsetX, e.offsetY);
        $(dragNode).css({
            "position": "absolute",
            "left": docPos.left,
            "top": docPos.top,
            "z-index": 200000, "opacity": 0.7
        });
        $(dragNode).attr("id", "dragNode");
        $('body').append(dragNode);
        $(dragNode).css({ "opacity": .5 });
        $(document).mousemove(function (e) { _this.DragNodeMoveHandler(e); });
        $(document).mouseleave(function (e) { _this.DragNodeLeaveHandler(e); });
        $(document).mouseup(function (e) { _this.DragNodeUpHandler(e); });
    };
    /**Mouse-Move-Handler beim verschieben des dragNodes*/
    SceneGraph.prototype.DragNodeMoveHandler = function (e) {
        e.preventDefault();
        var dragNode = $('#dragNode');
        $(dragNode).css({
            "left": (e.pageX - this.dragNodeOffset.x),
            "top": (e.pageY - this.dragNodeOffset.y)
        });
        if (this.IsElementUnderPoint(e.pageX, e.pageY, this.canvas) &&
            !this.IsElementUnderPoint(e.pageX, e.pageY, this.nodeCollection)) {
            $(dragNode).css({ "opacity": 1 });
        }
        else {
            $(dragNode).css({ "opacity": .5 });
        }
    };
    /**Mouse-Leave-Handler beim verschieben des DragNodes*/
    SceneGraph.prototype.DragNodeLeaveHandler = function (e) {
        $(document).off("mousemove mouseleave mouseup");
        $('#dragNode').remove();
    };
    /**Mouse-Up-Handler beim verschieben des DragNodes*/
    SceneGraph.prototype.DragNodeUpHandler = function (e) {
        $(document).off("mousemove mouseleave mouseup");
        //Wenn dragNode ordnungsgemäß über Canvas-Element fallen gelassen wurde
        if (this.IsElementUnderPoint(e.pageX, e.pageY, this.canvas) &&
            !this.IsElementUnderPoint(e.pageX, e.pageY, this.nodeCollection)) {
            var nodeType = $('#dragNode').attr('data-nodeType');
            var nodeName = $('#dragNode').attr('data-name');
            var nodeSize = (nodeType == SceneGraphNode.TYPE_GEOMETRY)
                ? this.loadData.geometryNodeSize : this.loadData.transformNodeSize;
            var logicalPos = new THREE.Vector2(e.pageX - $(this.target).offset().left - this.renderOffset.x - this.dragNodeOffset.x + nodeSize.x / 2, e.pageY - $(this.target).offset().top - this.renderOffset.y - this.dragNodeOffset.y + nodeSize.y / 2);
            this.CreateNode(nodeName, nodeType, logicalPos);
        }
        $('#dragNode').remove();
    };
    /**Mouse-Down auf ein Node*/
    SceneGraph.prototype.MouseDownOnNodeHandler = function (e) {
        var _this = this;
        e.preventDefault();
        var node = this.nodes[$(e.delegateTarget).attr('id')];
        this.cursorPosAtNodeDown = new THREE.Vector2(e.pageX, e.pageY);
        this.nodePosAtMouseDown = node.GetPos().clone();
        node.BringToForeground();
        var cursorNodeOffset = new THREE.Vector2(e.offsetX - node.size.x / 2, e.offsetY - node.size.y / 2);
        $(this.target).mouseup({ node: e.delegateTarget, cursorNodeOffset: cursorNodeOffset }, function (e) { _this.MouseUpOnNodeHandler(e); });
        $(this.target).mousemove({ node: e.delegateTarget, cursorNodeOffset: cursorNodeOffset }, function (e) { _this.MouseMoveOnNodeHandler(e); });
    };
    /**Mouse-Enter auf ein Node*/
    SceneGraph.prototype.MouseEnterOnNodeHandler = function (e) {
        this.mouseOverNodeID = $(e.delegateTarget).attr("id");
    };
    /**Mouse-Leave auf ein Node*/
    SceneGraph.prototype.MouseLeaveOnNodeHandler = function (e) {
        delete this.mouseOverNodeID;
    };
    /**Mouse-Move auf ein Node*/
    SceneGraph.prototype.MouseMoveOnNodeHandler = function (e) {
        e.preventDefault();
        var nodeID = $(e.data.node).attr('id');
        var currPos = new THREE.Vector2(e.pageX - this.cursorPosAtNodeDown.x + this.nodePosAtMouseDown.x, e.pageY - this.cursorPosAtNodeDown.y + this.nodePosAtMouseDown.y);
        if (this.mode == "moveNode") {
            this.nodes[nodeID].SetPos(new THREE.Vector2(currPos.x, currPos.y));
        }
        else {
            var nodePos = this.nodes[nodeID].GetPos();
            this.tempLine = new THREE.Vector4(this.nodePosAtMouseDown.x, this.nodePosAtMouseDown.y, currPos.x + e.data.cursorNodeOffset.x, currPos.y + e.data.cursorNodeOffset.y);
        }
    };
    /**Mouse-Up und Mouse-Out auf ein Node im Modus "moveNode"*/
    SceneGraph.prototype.MouseUpOnNodeHandler = function (e) {
        e.preventDefault();
        $(e.delegateTarget).off('mouseup mousemove');
        delete this.tempLine;
        var deltaMove = Math.sqrt(Math.pow((e.pageX - this.cursorPosAtNodeDown.x), 2) +
            Math.pow((e.pageY - this.cursorPosAtNodeDown.y), 2));
        var aNodeID = $(e.data.node).attr('id');
        var aNode = this.nodes[aNodeID];
        if (deltaMove < 5) {
            //Click auf Node
            if (typeof this.selectedNodeID != "undefined") {
                this.nodes[this.selectedNodeID].Deselect();
                delete this.selectedNodeID;
            }
            if (typeof this.selectedConnectionID != "undefined") {
                this.connections[this.selectedConnectionID].Deselect();
                delete this.selectedConnectionID;
            }
            aNode.Select();
            this.selectedNodeID = aNodeID;
            this.CorrectConnections();
            if (aNode.type == SceneGraphNode.TYPE_TRANSFORMATION) {
                this.onSelectTransformationNode(aNode.matrixX.clone(), aNode.matrixY.clone(), aNode.matrixZ.clone(), aNode.matrix.clone(), aNode.name);
            }
            else if (aNode.type == SceneGraphNode.TYPE_GEOMETRY) {
                this.onSelectGeometryNode(this.GetGeometryNodeMatrices(aNode), aNode.id);
            }
            else {
                this.onSelectRootNode();
            }
        }
        if (this.mode == SceneGraph.MODE_CREATE_CONNECTION && typeof this.mouseOverNodeID != "undefined") {
            var bNodeID = this.mouseOverNodeID;
            this.CreateConnection(aNodeID, bNodeID);
        }
    };
    /**Korrigiert alle Verbindungen (Typ, Bewegungsrichtung etc.)*/
    SceneGraph.prototype.CorrectConnections = function () {
        console.log("Verbindungen werden neu korrigiert");
        var correctedCons = [];
        for (var conID in this.connections)
            correctedCons[conID] = false;
        this.CorrectConnectionsProzess(this.rootNode, correctedCons);
        for (var conID in correctedCons) {
            if (!correctedCons[conID])
                this.connections[conID].state = SceneGraphConnection.STATE_INCOMPLETE;
        }
    };
    SceneGraph.prototype.CorrectConnectionsProzess = function (currNode, correctedCons, ignoreConID) {
        if (ignoreConID === void 0) { ignoreConID = ""; }
        var cons = currNode.usedConnections;
        var value = 0;
        if (currNode.type == SceneGraphNode.TYPE_GEOMETRY) {
            if (currNode.isSelected)
                return 2;
            return 1;
        }
        for (var conID in cons) {
            if (conID == ignoreConID)
                continue;
            if (cons[conID].GetANode().id == currNode.id)
                cons[conID].SwapNodes();
            var v = this.CorrectConnectionsProzess(cons[conID].GetANode(), correctedCons, conID);
            if (v > value)
                value = v;
            if (v == 0)
                cons[conID].state = SceneGraphConnection.STATE_INCOMPLETE;
            else if (v == 1)
                cons[conID].state = SceneGraphConnection.STATE_ACTIVE;
            else
                cons[conID].state = SceneGraphConnection.STATE_ACTIVE_MOVE;
            correctedCons[conID] = true;
        }
        return value;
    };
    /**Gibt alle Transformations-Matrizen aller Geometrie-Knoten zurück
    *@return  Ein Array mit Objekten der Form {geomNodeID:string, matrices:THREE.Matrix4[]}
    */
    SceneGraph.prototype.GetMatricesOfAllGeomNodes = function () {
        var matricesOfGeomNodes = [];
        for (var nodeID in this.nodes) {
            var node = this.nodes[nodeID];
            var obj = { geomNodeID: "", matrices: [] };
            if (node.type == SceneGraphNode.TYPE_GEOMETRY) {
                obj.geomNodeID = node.id;
                obj.matrices = this.GetGeometryNodeMatrices(node);
                matricesOfGeomNodes.push(obj);
            }
        }
        return matricesOfGeomNodes;
    };
    /**Gibt alle Namen der Knoten die der selektierten Geometrie-Knoten durchläuft*/
    SceneGraph.prototype.GetNodeNamesOfSelectedGeomNode = function () {
        var names = [];
        if (typeof this.selectedNodeID != "undefined") {
            var node = this.nodes[this.selectedNodeID];
            if (node.type == SceneGraphNode.TYPE_GEOMETRY)
                this.GetGeomNodeMatricesProzess(node, [], names);
        }
        return names;
    };
    /**Gibt alle Transformationsmatrizen des ausgewählten Geometrie-Knoten zurück
    *@return  Array mit allen Transformationsmatrizen oder falls kein Geometrie-Knoten ausgewählt ein leeres Array
    */
    SceneGraph.prototype.GetMatricesOfSelectedGeomNode = function () {
        var mats = [];
        if (typeof this.selectedNodeID != "undefined") {
            var node = this.nodes[this.selectedNodeID];
            if (node.type == SceneGraphNode.TYPE_GEOMETRY)
                mats = this.GetGeometryNodeMatrices(node);
        }
        return mats;
    };
    /**Gibt alle Transformationsmatrizen eines Geometrie-Knoten zurück die er durchläuft
    *@param  geomNode  Geometrie-Knoten
    *@return  Alle Matrizen die von dem übergebenen Geometrie-Knoten durchlaufen werden
    */
    SceneGraph.prototype.GetGeometryNodeMatrices = function (geomNode) {
        var mats = [];
        this.GetGeomNodeMatricesProzess(geomNode, mats);
        return mats;
    };
    SceneGraph.prototype.GetGeomNodeMatricesProzess = function (currNode, matrices, nodeNames, ignoreConID) {
        if (matrices === void 0) { matrices = []; }
        if (nodeNames === void 0) { nodeNames = []; }
        if (ignoreConID === void 0) { ignoreConID = ""; }
        if (currNode.type == SceneGraphNode.TYPE_ROOT)
            return true;
        for (var conID in currNode.usedConnections) {
            if (ignoreConID == conID)
                continue;
            var nextNode = this.connections[conID].GetOtherNode(currNode.id);
            if (this.GetGeomNodeMatricesProzess(nextNode, matrices, nodeNames, conID)) {
                matrices.push(currNode.matrix.clone());
                nodeNames.push(currNode.name);
                return true;
            }
        }
        return false;
    };
    /**Prüft ob sich ein DOM-Element unter einem Punkt befindet
    *@param  pointX   X-Position des Punktes
    *@param  pointY   Y-Position des Punktes
    *@param  domElem  Das zu prüfende DOM-Element
    *@return  Ein Boolen das aussagt ob sich das Dom-Element unter dem Punkt befindet
    */
    SceneGraph.prototype.IsElementUnderPoint = function (pointX, pointY, domElem) {
        var elemPos = $(domElem).offset();
        var elemSize = {
            width: $(domElem).outerWidth(),
            height: $(domElem).outerHeight()
        };
        if (pointX < elemPos.left || pointX > (elemPos.left + elemSize.width) ||
            pointY < elemPos.top || pointY > (elemPos.top + elemSize.height)) {
            return false;
        }
        return true;
    };
    /**Wird stetig ausgeführt*/
    SceneGraph.prototype.UpdateInterval = function () {
        var _this = this;
        this.intervalCounter++;
        this.Render();
        this.updateIntervalID = window.requestAnimationFrame(function () { return _this.UpdateInterval(); });
    };
    /**Zeichnet die Scene neu*/
    SceneGraph.prototype.Render = function () {
        this.ctx.fillRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
        for (var id in this.connections) {
            this.connections[id].render();
        }
        if (typeof this.tempLine != "undefined") {
            this.ctx.setLineDash([2, 4]);
            this.ctx.lineDashOffset = 0;
            this.ctx.lineWidth = 2;
            this.ctx.strokeStyle = "rgb(170,170,170)";
            this.ctx.beginPath();
            this.ctx.moveTo(this.tempLine.x + this.renderOffset.x, this.tempLine.y + this.renderOffset.y);
            this.ctx.lineTo(this.tempLine.z + this.renderOffset.x, this.tempLine.w + this.renderOffset.y);
            this.ctx.stroke();
        }
    };
    /**Setzt die Matrizen des selektierten Transformations-Knoten*/
    SceneGraph.prototype.SetMatricesOfSelectedTransNode = function (matX, matY, matZ, mat) {
        if (typeof this.selectedNodeID != "undefined") {
            var node = this.nodes[this.selectedNodeID];
            if (node.type == SceneGraphNode.TYPE_TRANSFORMATION) {
                node.matrixX = matX.clone();
                node.matrixY = matY.clone();
                node.matrixZ = matZ.clone();
                node.matrix = mat.clone();
            }
        }
    };
    /**Öffnet und schließt das Knoten-Sortiment*/
    SceneGraph.prototype.SwitchNodeCollectionVisibility = function () {
        this.isNodeCollectionHide = !this.isNodeCollectionHide;
        if (this.isNodeCollectionHide)
            $(this.nodeCollection).slideUp('fast');
        else
            $(this.nodeCollection).slideDown('fast');
    };
    /**Löscht das ausgewählten Element(Node oder Connection)*/
    SceneGraph.prototype.DeleteSelectedElement = function () {
        var hasDeletedTransNodeOrCon = false;
        if (typeof this.selectedConnectionID != "undefined") {
            var con = this.connections[this.selectedConnectionID];
            var aNode = con.GetANode();
            var bNode = con.GetBNode();
            delete aNode.usedConnections[con.id];
            delete bNode.usedConnections[con.id];
            this.connections[con.id].StopInterval();
            delete this.connections[con.id];
            delete this.selectedConnectionID;
            hasDeletedTransNodeOrCon = true;
        }
        else if (typeof this.selectedNodeID != "undefined") {
            var node = this.nodes[this.selectedNodeID];
            if (node.type != SceneGraphNode.TYPE_ROOT) {
                for (var conID in node.usedConnections) {
                    delete node.usedConnections[conID].GetOtherNode(node.id).usedConnections[conID];
                    delete node.usedConnections[conID];
                    this.connections[conID].StopInterval();
                    delete this.connections[conID];
                }
                this.nodes[node.id].StopInterval();
                delete this.nodes[node.id];
                delete this.selectedNodeID;
                $('#' + this.target.id + ' #' + node.id).remove();
                if (node.type == SceneGraphNode.TYPE_GEOMETRY)
                    this.onDeleteGeometryNode(node.id);
                else
                    hasDeletedTransNodeOrCon = true;
            }
            else {
                window.alert("The Root-Node can not be deleted!");
                return;
            }
        }
        this.CorrectConnections();
        if (hasDeletedTransNodeOrCon)
            this.onDeleteTransNodeOrConnection(this.GetMatricesOfAllGeomNodes());
    };
    /**Gibt den aktuellen Aufbau des Graphen als XML-String zurück*/
    SceneGraph.prototype.GetGraphAsXML = function () {
        var xml = '<?xml version="1.0" encoding="UTF-8"?>\n\n';
        xml += '<graph collectionName="' + this.loadData.currCollectionName + '" offsetX="' + this.renderOffset.x + '" offsetY="' + this.renderOffset.y + '">\n';
        xml += '    <nodes>\n';
        for (var id in this.nodes) {
            var node = this.nodes[id];
            xml += '        <node id="' + node.id + '" type="' + node.type + '" name="' + node.name + '" posX="' + node.GetPos().x + '" posY="' + node.GetPos().y + '">\n';
            xml += '            <matrixX>';
            for (var i = 0; i < node.matrixX.elements.length; i++)
                xml += (i < node.matrixX.elements.length - 1) ? node.matrixX.elements[i] + ', ' : node.matrixX.elements[i].toString();
            xml += '</matrixX>\n';
            xml += '            <matrixY>';
            for (var i = 0; i < node.matrixY.elements.length; i++)
                xml += (i < node.matrixY.elements.length - 1) ? node.matrixY.elements[i] + ', ' : node.matrixY.elements[i].toString();
            xml += '</matrixY>\n';
            xml += '            <matrixZ>';
            for (var i = 0; i < node.matrixZ.elements.length; i++)
                xml += (i < node.matrixZ.elements.length - 1) ? node.matrixZ.elements[i] + ', ' : node.matrixZ.elements[i].toString();
            xml += '</matrixZ>\n';
            xml += '            <matrix>';
            for (var i = 0; i < node.matrix.elements.length; i++)
                xml += (i < node.matrix.elements.length - 1) ? node.matrix.elements[i] + ', ' : node.matrix.elements[i].toString();
            xml += '</matrix>\n';
            xml += '        </node>\n';
        }
        xml += '    </nodes>\n\n';
        xml += '    <connections>\n';
        for (var id in this.connections) {
            var con = this.connections[id];
            xml += '        <connection id="' + this.connections[id].id + '" aNodeID="' + this.connections[id].GetANode().id + '" bNodeID="' + this.connections[id].GetBNode().id + '"></connection>\n';
        }
        xml += '    </connections>\n';
        xml += '</graph>';
        return xml;
    };
    /**Löscht alle Knoten und Verbindungen und setzt den Scene-Graphen auf den Ursprungszustand
    *@param  createRootNode  Ob ein Root-Knoten neu erstellt werden soll. Default: false
    */
    SceneGraph.prototype.Reset = function (createRootNode) {
        if (createRootNode === void 0) { createRootNode = false; }
        delete this.selectedConnectionID;
        delete this.selectedNodeID;
        this.renderOffset.x = 0;
        this.renderOffset.y = 0;
        for (var conID in this.connections) {
            this.connections[conID].Deselect();
            delete this.connections[conID];
        }
        for (var nodeID in this.nodes) {
            this.nodes[nodeID].Deselect();
            delete this.nodes[nodeID];
        }
        delete this.rootNode;
        SceneGraphNode.highestZIndex = 11;
        SceneGraphConnection.highestConnectionID = 0;
        $(this.target).find(' div[data-nodetype]').not('.collectionNode').remove();
        if (createRootNode)
            this.CreateNode("world", SceneGraphNode.TYPE_ROOT, new THREE.Vector2(214, 40));
    };
    /**Wechselt die Node-Collection und stellt den Graphen zurück auf den Ursprungszustand
    *@param  collectionName  Der Name der neuen Collection
    */
    SceneGraph.prototype.ChangeCollection = function (collectionName) {
        var _this = this;
        this.loadData.ChangeCollection(collectionName);
        this.Reset(true);
        var nodeNames = this.loadData.GetGeometryNodeNames();
        var nodeFileNames = this.loadData.GetGeometryNodeImageFileNames();
        var nodeTitles = this.loadData.GetGeometryNodeTitles();
        $('#nodeCollection .collectionNode').remove();
        var html = '';
        var s = this.loadData.geometryNodeSize;
        for (var i = 0; i < nodeFileNames.length; i++) {
            html +=
                '<div class="collectionNode" data-nodeType="geometry" data-name="' + nodeNames[i] + '" title="' + nodeTitles[i] +
                    '" style="float:left; width:' + s.x + 'px; height:' + s.y + 'px; cursor:pointer; ' +
                    'background-image:url(\'' + this.loadData.nodeImagesPath + nodeFileNames[i] + '\');' +
                    'background-size:' + s.x + 'px ' + s.y + 'px; background-repeat:no-repeat"></div>';
        }
        this.geomNodeCollectionContainer$.append(html);
        html = '';
        var s = this.loadData.transformNodeSize;
        nodeNames = ["tt", "tr", "ts"];
        nodeFileNames = [
            this.loadData.ttNodeImageFileName,
            this.loadData.trNodeImageFileName,
            this.loadData.tsNodeImageFileName
        ];
        nodeTitles = ["translation", "rotation", "scale"];
        for (var i = 0; i < nodeFileNames.length; i++) {
            html +=
                '<div class="collectionNode" data-nodeType="transformation" data-name="' + nodeNames[i] + '" title="' + nodeTitles[i] +
                    '" style="float:left; width:' + s.x + 'px; height:' + s.y + 'px; cursor:pointer;' +
                    'background-image:url(\'' + this.loadData.nodeImagesPath + nodeFileNames[i] + '\');' +
                    'background-size:' + s.x + 'px ' + s.y + 'px; background-repeat:no-repeat"></div>';
        }
        this.transNodeCollectionContainer$.append(html);
        $('#nodeCollection .collectionNode').mousedown(function (e) {
            _this.MouseDownOnCollectionNodeHandler(e);
        });
    };
    /**Erstellt einen neuen Knoten.
    *HINWEIS: Die passende Node-Collection muss vorher geladen worden sein
    *@param  name  Der Name des Knotens ("tr", "tt", "footHinge" etc.)
    *@param  type  Der Typ des Knotens ("transformation", "geometry")
    *@param  pos   Logische Position
    *@param  matX  X-Matrix
    *@param  matY  Y-Matrix
    *@param  matZ  Z-Matrix
    *@param  mat   Gesamte Matrix, multipliert aus x-, y-, z-Matrix
    *@return  Die neu vergebene ID des Knoten
    */
    SceneGraph.prototype.CreateNode = function (name, type, pos, matX, matY, matZ, mat) {
        var _this = this;
        if (matX === void 0) { matX = new THREE.Matrix4(); }
        if (matY === void 0) { matY = new THREE.Matrix4(); }
        if (matZ === void 0) { matZ = new THREE.Matrix4(); }
        if (mat === void 0) { mat = new THREE.Matrix4(); }
        var id = "node" + SceneGraphNode.highestZIndex;
        var title = "node";
        var nodeSize;
        var cssImageURL;
        if (type == SceneGraphNode.TYPE_GEOMETRY) {
            nodeSize = this.loadData.geometryNodeSize;
            var names = this.loadData.GetGeometryNodeNames();
            var titles = this.loadData.GetGeometryNodeTitles();
            for (var i = 0; i < names.length; i++) {
                if (name == names[i]) {
                    cssImageURL = "url('" + this.loadData.nodeImagesPath + this.loadData.GetGeometryNodeImageFileNames()[i] + "')";
                    title = titles[i];
                    break;
                }
            }
        }
        else if (type == SceneGraphNode.TYPE_TRANSFORMATION) {
            nodeSize = this.loadData.transformNodeSize;
            if (name == "tt") {
                cssImageURL = "url('" + this.loadData.nodeImagesPath + this.loadData.ttNodeImageFileName + "')";
                title = "translation";
            }
            else if (name == "tr") {
                cssImageURL = "url('" + this.loadData.nodeImagesPath + this.loadData.trNodeImageFileName + "')";
                title = "rotation";
            }
            else if (name == "ts") {
                cssImageURL = "url('" + this.loadData.nodeImagesPath + this.loadData.tsNodeImageFileName + "')";
                title = "scale";
            }
        }
        else {
            nodeSize = this.loadData.geometryNodeSize;
            cssImageURL = "url('" + this.loadData.nodeImagesPath + this.loadData.rootNodeImageFileName + "')";
            title = "world";
        }
        this.nodes[id] = new SceneGraphNode(id, this.target, this.renderOffset, type, name, pos, nodeSize, cssImageURL, title);
        if (type == SceneGraphNode.TYPE_ROOT)
            this.rootNode = this.nodes[id];
        this.nodes[id].matrixX = matX;
        this.nodes[id].matrixY = matY;
        this.nodes[id].matrixZ = matZ;
        this.nodes[id].matrix = mat;
        $(this.nodes[id].htmlNode).mousedown(function (e) { _this.MouseDownOnNodeHandler(e); });
        $(this.nodes[id].htmlNode).mouseenter(function (e) { _this.MouseEnterOnNodeHandler(e); });
        $(this.nodes[id].htmlNode).mouseleave(function (e) { _this.MouseLeaveOnNodeHandler(e); });
        if (type == SceneGraphNode.TYPE_GEOMETRY)
            this.onCreateGeometryNode(name, id);
        console.log("Knoten '" + id + "' wurde erstellt");
        return id;
    };
    /**Erstellt eine neue Verbindung
    *@param  aNodeID  Die ID des A-Knoten
    *@param  bNodeID  Die ID des B-Knoten
    *@return  Die neu vergebene ID der Verbindung oder "undefined" falls Verbindung nicht erlaubt
    */
    SceneGraph.prototype.CreateConnection = function (aNodeID, bNodeID) {
        var id = "undefined";
        var aNode = this.nodes[aNodeID];
        var bNode = this.nodes[bNodeID];
        if (aNode.CanConnectWithNode(bNode) && bNode.CanConnectWithNode(aNode)) {
            id = "connection" + SceneGraphConnection.highestConnectionID;
            this.connections[id] = new SceneGraphConnection(id, this.ctx, this.renderOffset, SceneGraphConnection.STATE_INCOMPLETE, aNode, bNode);
            aNode.usedConnections[id] = this.connections[id];
            bNode.usedConnections[id] = this.connections[id];
            this.CorrectConnections();
            this.onCreateConnection();
            console.log("Verbindung '" + id + "' wurde erstellt");
        }
        return id;
    };
    SceneGraph.MODE_MOVE_NODE = "moveNode";
    SceneGraph.MODE_CREATE_CONNECTION = "createConnection";
    return SceneGraph;
})();
/**
*@author Jarek Sarbiewski
*/
var MatricesOutput = (function () {
    /**Konstruktor
    *@param  target  Ein DIV-Element indem die Knoten-Einstellungen dargestellt werden sollen
    */
    function MatricesOutput(target) {
        this.state = "";
        this.isHide = false;
        this.target = target;
        this.Init();
    }
    /**Initialisierung*/
    MatricesOutput.prototype.Init = function () {
        $(this.target).css({ "overflow": "hidden", "border-bottom": "1px solid #ccc", "margin-bottom": "10px" });
        $(this.target).append('<p><em id="matricesOutputLabel"></em></p><div id="matricesContainer"></div>');
        this.label = $('#matricesOutputLabel');
        this.label.parent('p').css("padding-bottom", "10px");
        this.matricesContainer = $('#matricesContainer');
        this.matricesContainer.css({ "overflow": "hidden" });
        this.matrixTemplate = $('<div class="matrixContainer"></div>');
        var matrix = $('<div class="matrix"></div>');
        var matLabel = $('<div class="matLabel"><span class="matLabel1"></span><span class="matLabel2"></span></div>');
        var mathSymbol = $('<div class="mathSymbol">&bull;</div>');
        this.matrixTemplate.append(matLabel);
        this.matrixTemplate.append(matrix);
        this.matrixTemplate.append(mathSymbol);
        this.matrixTemplate.css({ "overflow": "hidden", "float": "left" });
        matLabel.css({
            "float": "left",
            "min-width": "48px",
            "height": "22px",
            "padding": "30px 5px 38px 0",
            "text-align": "right"
        });
        matLabel.find(' .matLabel1').css({ "color": "#686868", "font-size": "22px" });
        matLabel.find(' .matLabel2').css({ "color": "#686868", "font-size": "14px" });
        matrix.css({
            "overflow": "hidden",
            "float": "left",
            "height": "80px",
            "border-radius": "10px",
            "border-left": "2px solid #7f7f7f",
            "border-right": "2px solid #7f7f7f",
            "margin-bottom": "15px",
            "padding": "0 2px"
        });
        mathSymbol.css({
            "float": "left",
            "min-width": "17px",
            "height": "22px",
            "color": "#686868",
            "font-size": "22px",
            "padding": "30px 0 38px 5px",
            "text-align": "right"
        });
        matrix.append('<table>' +
            '   <tr class="row row1"><td class="col col1">1</td><td class="col col2">0</td><td class="col col3">0</td><td class="col col4">0</td></tr>' +
            '   <tr class="row row2"><td class="col col1">0</td><td class="col col2">1</td><td class="col col3">0</td><td class="col col4">0</td></tr>' +
            '   <tr class="row row3"><td class="col col1">0</td><td class="col col2">0</td><td class="col col3">1</td><td class="col col4">0</td></tr>' +
            '   <tr class="row row4"><td class="col col1">0</td><td class="col col2">0</td><td class="col col3">0</td><td class="col col4">1</td></tr>' +
            '</table>');
        matrix.find(' .col').css({
            "padding": "0 2px",
            "min-width": "32px",
            "height": "20px",
            "text-align": "center",
            "vertical-align": "middle",
            "color": "#686868",
            "font-size": "13px"
        });
        this.SettingUpRoot();
    };
    /**Stellt die Matrizen-Ausgabe auf den Status "root" und stellt diese ein*/
    MatricesOutput.prototype.SettingUpRoot = function () {
        if (this.state == MatricesOutput.STATE_ROOT)
            return;
        this.label.empty().append('Matrix for Root-Node');
        var matTemplate = this.matrixTemplate.clone();
        matTemplate.find(' .mathSymbol').remove();
        matTemplate.find(' .matLabel2').append('WORLD');
        this.matricesContainer.empty().append(matTemplate);
        this.state = MatricesOutput.STATE_ROOT;
    };
    /**Stellt die Matrizen-Ausgabe auf den Status "Geometry" und stellt diese ein
    *@param  matrices  alle Matrizen für die Ausgabe
    *@param  names     Die dazugehörigen Namen der Knoten zu den Matrizen
    */
    MatricesOutput.prototype.SettingUpGeometry = function (matrices, names) {
        this.label.empty().append('Matrices for selected Geometry-Node');
        this.matricesContainer.empty();
        var fullMat = new THREE.Matrix4();
        var matTemplate = this.matrixTemplate.clone();
        var matLabel2 = matTemplate.find(' .matLabel2');
        var mathSymbol = matTemplate.find(' .mathSymbol');
        if (matrices.length == 0) {
            matLabel2.append('GEOM');
            mathSymbol.remove();
        }
        else if (matrices.length == 1) {
            matLabel2.append('WORLD');
            mathSymbol.empty().append('=');
        }
        else {
            matLabel2.append('WORLD');
            mathSymbol.empty().append('&bull;');
        }
        this.matricesContainer.append(matTemplate);
        for (var i = 0; i < matrices.length; i++) {
            var matContainer$ = this.matrixTemplate.clone();
            var mat$ = matContainer$.find(' .matrix');
            var mat = matrices[i];
            fullMat.multiplyMatrices(fullMat, mat);
            if (i == matrices.length - 1) {
                var matLabel2 = matContainer$.find(' .matLabel2');
                matLabel2.append('GEOM');
                var mathSymbol = matContainer$.find(' .mathSymbol');
                mathSymbol.remove();
                for (var j = 0; j < fullMat.elements.length; j++) {
                    var col = (j % 4 + 1).toFixed(0);
                    var row = (Math.floor(j / 4) + 1).toFixed(0);
                    if (fullMat.elements[j] == 1 || fullMat.elements[j] == 0)
                        mat$.find(' .row' + col + ' .col' + row).empty().append(fullMat.elements[j].toFixed(0));
                    else
                        mat$.find(' .row' + col + ' .col' + row).empty().append(fullMat.elements[j].toFixed(2));
                }
                this.matricesContainer.append(matContainer$);
            }
            else {
                var matLabel1 = matContainer$.find(' .matLabel1');
                matLabel1.append('T');
                var matLabel2 = matContainer$.find(' .matLabel2');
                var mathSymbol = matContainer$.find(' .mathSymbol');
                if (i == matrices.length - 2)
                    mathSymbol.empty().append('&asymp;');
                if (names[i] == "tt") {
                    matLabel2.append('T');
                    matLabel1.css("color", "#e74d15");
                    matLabel2.css("color", "#e74d15");
                    mat$.css("border-color", "#e74d15");
                }
                else if (names[i] == "tr") {
                    matLabel2.append('R');
                    matLabel1.css("color", "#bc0017");
                    matLabel2.css("color", "#bc0017");
                    mat$.css("border-color", "#bc0017");
                }
                else if (names[i] == "ts") {
                    matLabel2.append('S');
                    matLabel1.css("color", "#9f1982");
                    matLabel2.css("color", "#9f1982");
                    mat$.css("border-color", "#9f1982");
                }
                for (var j = 0; j < mat.elements.length; j++) {
                    var col = (j % 4 + 1).toFixed(0);
                    var row = (Math.floor(j / 4) + 1).toFixed(0);
                    if (mat.elements[j] == 1 || mat.elements[j] == 0)
                        mat$.find(' .row' + col + ' .col' + row).empty().append(mat.elements[j].toFixed(0));
                    else
                        mat$.find(' .row' + col + ' .col' + row).empty().append(mat.elements[j].toFixed(2));
                }
                this.matricesContainer.append(matContainer$);
            }
        }
        this.state = MatricesOutput.STATE_GEOMETRY;
    };
    /**Stellt die Matrizen-Ausgabe auf den Status "Translation" und stellt diese ein
    *@param  matX  Translation-Matrix bzgl. der X-Achse
    *@param  matY  Translation-Matrix bzgl. der Y-Achse
    *@param  matZ  Translation-Matrix bzgl. der Z-Achse
    */
    MatricesOutput.prototype.SettingUpTranslation = function (matX, matY, matZ) {
        var fullMat = new THREE.Matrix4();
        fullMat.multiplyMatrices(fullMat, matX);
        fullMat.multiplyMatrices(fullMat, matY);
        fullMat.multiplyMatrices(fullMat, matZ);
        if (this.state == MatricesOutput.STATE_TRANSFORM_TRANSLATION) {
            var colX = this.matricesContainer.find(' .matrixContainer:nth-child(1) .row1 .col4');
            var colY = this.matricesContainer.find(' .matrixContainer:nth-child(2) .row2 .col4');
            var colZ = this.matricesContainer.find(' .matrixContainer:nth-child(3) .row3 .col4');
            var fullMatColX = this.matricesContainer.find(' .matrixContainer:nth-child(4) .row1 .col4');
            var fullMatColY = this.matricesContainer.find(' .matrixContainer:nth-child(4) .row2 .col4');
            var fullMatColZ = this.matricesContainer.find(' .matrixContainer:nth-child(4) .row3 .col4');
            colX.empty().append(matX.elements[12].toFixed(2));
            colY.empty().append(matY.elements[13].toFixed(2));
            colZ.empty().append(matZ.elements[14].toFixed(2));
            fullMatColX.empty().append(fullMat.elements[12].toFixed(2));
            fullMatColY.empty().append(fullMat.elements[13].toFixed(2));
            fullMatColZ.empty().append(fullMat.elements[14].toFixed(2));
        }
        else {
            this.label.empty().append('Matrices for Translation-Node');
            this.matricesContainer.empty();
            //matX
            var matTemplate = this.matrixTemplate.clone();
            matTemplate.find(' .matLabel').remove();
            var col = matTemplate.find(' .row1 .col4');
            col.css("color", "#bc0017");
            col.empty().append(matX.elements[12].toFixed(2));
            this.matricesContainer.append(matTemplate.clone());
            //matY
            matTemplate = this.matrixTemplate.clone();
            matTemplate.find(' .matLabel').remove();
            col = matTemplate.find(' .row2 .col4');
            col.css("color", "#008a22");
            col.empty().append(matY.elements[13].toFixed(2));
            this.matricesContainer.append(matTemplate.clone());
            //matZ
            matTemplate = this.matrixTemplate.clone();
            matTemplate.find(' .matLabel').remove();
            col = matTemplate.find(' .row3 .col4');
            col.css("color", "#3a839c");
            col.empty().append(matZ.elements[14].toFixed(2));
            matTemplate.find(' .mathSymbol').empty().append('&asymp;');
            this.matricesContainer.append(matTemplate.clone());
            //gesamt-Mat
            matTemplate = this.matrixTemplate.clone();
            matTemplate.find(' .matLabel1').append('T').css({ "color": "#e74d15" });
            matTemplate.find(' .matrix').css({ "border-color": "#e74d15" });
            matTemplate.find(' .matLabel2').append('T').css("color", "#e74d15");
            matTemplate.find(' .row1 .col4, .row2 .col4, .row3 .col4').css('font-weight', '700');
            matTemplate.find(' .row1 .col4').empty().append(fullMat.elements[12].toFixed(2));
            matTemplate.find(' .row2 .col4').empty().append(fullMat.elements[13].toFixed(2));
            matTemplate.find(' .row3 .col4').empty().append(fullMat.elements[14].toFixed(2));
            matTemplate.find(' .mathSymbol').remove();
            this.matricesContainer.append(matTemplate.clone());
            this.matricesContainer.find(' .mathSymbol').css({ "padding": "30px 10px 38px 10px", "text-align": "center" });
            this.matricesContainer.find(' .matrix .col').css({ "min-width": "36px", "padding": "0 4px" });
            this.matricesContainer.find(' .matrixContainer .matLabel').css("min-width", "30px");
        }
        this.state = MatricesOutput.STATE_TRANSFORM_TRANSLATION;
    };
    /**Stellt die Matrizen-Ausgabe auf den Status "Rotation" und stellt diese ein
    *@param  matX  Rotation-Matrix bzgl. der X-Achse
    *@param  matY  Rotation-Matrix bzgl. der Y-Achse
    *@param  matZ  Rotation-Matrix bzgl. der Z-Achse
    */
    MatricesOutput.prototype.SettingUpRotation = function (matX, matY, matZ) {
        var fullMat = new THREE.Matrix4();
        fullMat.multiplyMatrices(fullMat, matX);
        fullMat.multiplyMatrices(fullMat, matY);
        fullMat.multiplyMatrices(fullMat, matZ);
        var degX = Math.acos(matX.elements[5]) / Math.PI * 180;
        var degY = Math.acos(matY.elements[0]) / Math.PI * 180;
        var degZ = Math.acos(matZ.elements[0]) / Math.PI * 180;
        if (Math.asin(matX.elements[6]) / Math.PI * 180 < 0)
            degX *= -1;
        if (Math.asin(matY.elements[8]) / Math.PI * 180 < 0)
            degY *= -1;
        if (Math.asin(matZ.elements[1]) / Math.PI * 180 < 0)
            degZ *= -1;
        if (this.state == MatricesOutput.STATE_TRANSFORM_ROTATION) {
            var colX1 = this.matricesContainer.find(' .matrixContainer:nth-child(1) .row2 .col2');
            var colX2 = this.matricesContainer.find(' .matrixContainer:nth-child(1) .row2 .col3');
            var colX3 = this.matricesContainer.find(' .matrixContainer:nth-child(1) .row3 .col2');
            var colX4 = this.matricesContainer.find(' .matrixContainer:nth-child(1) .row3 .col3');
            var colY1 = this.matricesContainer.find(' .matrixContainer:nth-child(2) .row1 .col1');
            var colY2 = this.matricesContainer.find(' .matrixContainer:nth-child(2) .row1 .col3');
            var colY3 = this.matricesContainer.find(' .matrixContainer:nth-child(2) .row3 .col1');
            var colY4 = this.matricesContainer.find(' .matrixContainer:nth-child(2) .row3 .col3');
            var colZ1 = this.matricesContainer.find(' .matrixContainer:nth-child(3) .row1 .col1');
            var colZ2 = this.matricesContainer.find(' .matrixContainer:nth-child(3) .row1 .col2');
            var colZ3 = this.matricesContainer.find(' .matrixContainer:nth-child(3) .row2 .col1');
            var colZ4 = this.matricesContainer.find(' .matrixContainer:nth-child(3) .row2 .col2');
            var fullMatCol1 = this.matricesContainer.find(' .matrixContainer:nth-child(4) .row1 .col1');
            var fullMatCol2 = this.matricesContainer.find(' .matrixContainer:nth-child(4) .row1 .col2');
            var fullMatCol3 = this.matricesContainer.find(' .matrixContainer:nth-child(4) .row1 .col3');
            var fullMatCol4 = this.matricesContainer.find(' .matrixContainer:nth-child(4) .row2 .col1');
            var fullMatCol5 = this.matricesContainer.find(' .matrixContainer:nth-child(4) .row2 .col2');
            var fullMatCol6 = this.matricesContainer.find(' .matrixContainer:nth-child(4) .row2 .col3');
            var fullMatCol7 = this.matricesContainer.find(' .matrixContainer:nth-child(4) .row3 .col1');
            var fullMatCol8 = this.matricesContainer.find(' .matrixContainer:nth-child(4) .row3 .col2');
            var fullMatCol9 = this.matricesContainer.find(' .matrixContainer:nth-child(4) .row3 .col3');
            colX1.empty().append("cos(" + degX.toFixed(0) + "°)");
            colX2.empty().append("-sin(" + degX.toFixed(0) + "°)");
            colX3.empty().append("sin(" + degX.toFixed(0) + "°)");
            colX4.empty().append("cos(" + degX.toFixed(0) + "°)");
            colY1.empty().append("cos(" + degY.toFixed(0) + "°)");
            colY2.empty().append("sin(" + degY.toFixed(0) + "°)");
            colY3.empty().append("-sin(" + degY.toFixed(0) + "°)");
            colY4.empty().append("cos(" + degY.toFixed(0) + "°)");
            colZ1.empty().append("cos(" + degZ.toFixed(0) + "°)");
            colZ2.empty().append("-sin(" + degZ.toFixed(0) + "°)");
            colZ3.empty().append("sin(" + degZ.toFixed(0) + "°)");
            colZ4.empty().append("cos(" + degZ.toFixed(0) + "°)");
            fullMatCol1.empty().append(fullMat.elements[0].toFixed(2));
            fullMatCol2.empty().append(fullMat.elements[4].toFixed(2));
            fullMatCol3.empty().append(fullMat.elements[8].toFixed(2));
            fullMatCol4.empty().append(fullMat.elements[1].toFixed(2));
            fullMatCol5.empty().append(fullMat.elements[5].toFixed(2));
            fullMatCol6.empty().append(fullMat.elements[9].toFixed(2));
            fullMatCol7.empty().append(fullMat.elements[2].toFixed(2));
            fullMatCol8.empty().append(fullMat.elements[6].toFixed(2));
            fullMatCol9.empty().append(fullMat.elements[10].toFixed(2));
        }
        else {
            this.label.empty().append('Matrices for Rotation-Node');
            this.matricesContainer.empty();
            //matX
            var matTemplate = this.matrixTemplate.clone();
            matTemplate.find(' .matLabel').remove();
            var cols = matTemplate.find(' .row2 .col2, .row2 .col3, .row3 .col2, .row3 .col3');
            var col1 = matTemplate.find(' .row2 .col2');
            var col2 = matTemplate.find(' .row2 .col3');
            var col3 = matTemplate.find(' .row3 .col2');
            var col4 = matTemplate.find(' .row3 .col3');
            cols.css("color", "#bc0017");
            col1.empty().append("cos(" + degX.toFixed(0) + "°)");
            col2.empty().append("-sin(" + degX.toFixed(0) + "°)");
            col3.empty().append("sin(" + degX.toFixed(0) + "°)");
            col4.empty().append("cos(" + degX.toFixed(0) + "°)");
            this.matricesContainer.append(matTemplate.clone());
            //matY
            matTemplate = this.matrixTemplate.clone();
            matTemplate.find(' .matLabel').remove();
            cols = matTemplate.find(' .row1 .col1, .row1 .col3, .row3 .col1, .row3 .col3');
            col1 = matTemplate.find(' .row1 .col1');
            col2 = matTemplate.find(' .row1 .col3');
            col3 = matTemplate.find(' .row3 .col1');
            col4 = matTemplate.find(' .row3 .col3');
            cols.css("color", "#008a22");
            col1.empty().append("cos(" + degY.toFixed(0) + "°)");
            col2.empty().append("sin(" + degY.toFixed(0) + "°)");
            col3.empty().append("-sin(" + degY.toFixed(0) + "°)");
            col4.empty().append("cos(" + degY.toFixed(0) + "°)");
            this.matricesContainer.append(matTemplate.clone());
            //matZ
            matTemplate = this.matrixTemplate.clone();
            matTemplate.find(' .matLabel').remove();
            cols = matTemplate.find(' .row1 .col1, .row1 .col2, .row2 .col1, .row2 .col2');
            col1 = matTemplate.find(' .row1 .col1');
            col2 = matTemplate.find(' .row1 .col2');
            col3 = matTemplate.find(' .row2 .col1');
            col4 = matTemplate.find(' .row2 .col2');
            cols.css("color", "#3a839c");
            col1.empty().append("cos(" + degZ.toFixed(0) + "°)");
            col2.empty().append("-sin(" + degZ.toFixed(0) + "°)");
            col3.empty().append("sin(" + degZ.toFixed(0) + "°)");
            col4.empty().append("cos(" + degZ.toFixed(0) + "°)");
            matTemplate.find(' .mathSymbol').empty().append('&asymp;');
            this.matricesContainer.append(matTemplate.clone());
            //gesamt-Mat
            matTemplate = this.matrixTemplate.clone();
            matTemplate.find(' .matLabel1').append('T').css({ "color": "#bc0017" });
            matTemplate.find(' .matrix').css({ "border-color": "#bc0017" });
            matTemplate.find(' .matLabel2').append('R').css("color", "#bc0017");
            matTemplate.find(' .row1 .col1, .row1 .col2, .row1 .col3, .row2 .col1, .row2 .col2, .row2 .col3, .row3 .col1, .row3 .col2, .row3 .col3').css('font-weight', '700');
            matTemplate.find(' .row1 .col1').empty().append(fullMat.elements[0].toFixed(2));
            matTemplate.find(' .row1 .col2').empty().append(fullMat.elements[4].toFixed(2));
            matTemplate.find(' .row1 .col3').empty().append(fullMat.elements[8].toFixed(2));
            matTemplate.find(' .row2 .col1').empty().append(fullMat.elements[1].toFixed(2));
            matTemplate.find(' .row2 .col2').empty().append(fullMat.elements[5].toFixed(2));
            matTemplate.find(' .row2 .col3').empty().append(fullMat.elements[9].toFixed(2));
            matTemplate.find(' .row3 .col1').empty().append(fullMat.elements[2].toFixed(2));
            matTemplate.find(' .row3 .col2').empty().append(fullMat.elements[6].toFixed(2));
            matTemplate.find(' .row3 .col3').empty().append(fullMat.elements[10].toFixed(2));
            matTemplate.find(' .mathSymbol').remove();
            this.matricesContainer.append(matTemplate.clone());
            this.matricesContainer.find(' .mathSymbol').css({ "padding": "30px 10px 38px 10px", "text-align": "center" });
            this.matricesContainer.find(' .matrix .col').css({ "min-width": "55px", "padding": "0 4px" });
            this.matricesContainer.find(' .matrixContainer:nth-child(1) .col1, .matrixContainer:nth-child(1) .col4').css("min-width", "17px");
            this.matricesContainer.find(' .matrixContainer:nth-child(2) .col2, .matrixContainer:nth-child(2) .col4').css("min-width", "17px");
            this.matricesContainer.find(' .matrixContainer:nth-child(3) .col3, .matrixContainer:nth-child(3) .col4').css("min-width", "17px");
            this.matricesContainer.find(' .matrixContainer:nth-child(4) .col').css("min-width", "36px");
            this.matricesContainer.find(' .matrixContainer .matLabel').css("min-width", "30px");
        }
        this.state = MatricesOutput.STATE_TRANSFORM_ROTATION;
    };
    /**Stellt die Matrizen-Ausgabe auf den Status "Scale" und stellt diese ein
    *@param  matX  Scale-Matrix bzgl. der X-Achse
    *@param  matY  Scale-Matrix bzgl. der Y-Achse
    *@param  matZ  Scale-Matrix bzgl. der Z-Achse
    */
    MatricesOutput.prototype.SettingUpScale = function (matX, matY, matZ) {
        var fullMat = new THREE.Matrix4();
        fullMat.multiplyMatrices(fullMat, matX);
        fullMat.multiplyMatrices(fullMat, matY);
        fullMat.multiplyMatrices(fullMat, matZ);
        if (this.state == MatricesOutput.STATE_TRANSFORM_SCALE) {
            var colX = this.matricesContainer.find(' .matrixContainer:nth-child(1) .row1 .col1');
            var colY = this.matricesContainer.find(' .matrixContainer:nth-child(2) .row2 .col2');
            var colZ = this.matricesContainer.find(' .matrixContainer:nth-child(3) .row3 .col3');
            var fullMatColX = this.matricesContainer.find(' .matrixContainer:nth-child(4) .row1 .col1');
            var fullMatColY = this.matricesContainer.find(' .matrixContainer:nth-child(4) .row2 .col2');
            var fullMatColZ = this.matricesContainer.find(' .matrixContainer:nth-child(4) .row3 .col3');
            colX.empty().append(matX.elements[0].toFixed(2));
            colY.empty().append(matY.elements[5].toFixed(2));
            colZ.empty().append(matZ.elements[10].toFixed(2));
            fullMatColX.empty().append(fullMat.elements[0].toFixed(2));
            fullMatColY.empty().append(fullMat.elements[5].toFixed(2));
            fullMatColZ.empty().append(fullMat.elements[10].toFixed(2));
        }
        else {
            this.label.empty().append('Matrices for Scale-Node');
            this.matricesContainer.empty();
            //matX
            var matTemplate = this.matrixTemplate.clone();
            matTemplate.find(' .matLabel').remove();
            var col = matTemplate.find(' .row1 .col1');
            col.css("color", "#bc0017");
            col.empty().append(matX.elements[0].toFixed(2));
            this.matricesContainer.append(matTemplate.clone());
            //matY
            matTemplate = this.matrixTemplate.clone();
            matTemplate.find(' .matLabel').remove();
            col = matTemplate.find(' .row2 .col2');
            col.css("color", "#008a22");
            col.empty().append(matY.elements[5].toFixed(2));
            this.matricesContainer.append(matTemplate.clone());
            //matZ
            matTemplate = this.matrixTemplate.clone();
            matTemplate.find(' .matLabel').remove();
            col = matTemplate.find(' .row3 .col3');
            col.css("color", "#3a839c");
            col.empty().append(matZ.elements[10].toFixed(2));
            matTemplate.find(' .mathSymbol').empty().append('&asymp;');
            this.matricesContainer.append(matTemplate.clone());
            //gesamt-Mat
            matTemplate = this.matrixTemplate.clone();
            matTemplate.find(' .matLabel1').append('T').css({ "color": "#9f1982" });
            matTemplate.find(' .matrix').css({ "border-color": "#9f1982" });
            matTemplate.find(' .matLabel2').append('S').css("color", "#9f1982");
            matTemplate.find(' .row1 .col1, .row2 .col2, .row3 .col3').css('font-weight', '700');
            matTemplate.find(' .row1 .col1').empty().append(fullMat.elements[0].toFixed(2));
            matTemplate.find(' .row2 .col2').empty().append(fullMat.elements[5].toFixed(2));
            matTemplate.find(' .row3 .col3').empty().append(fullMat.elements[10].toFixed(2));
            matTemplate.find(' .mathSymbol').remove();
            this.matricesContainer.append(matTemplate.clone());
            this.matricesContainer.find(' .mathSymbol').css({ "padding": "30px 10px 38px 10px", "text-align": "center" });
            this.matricesContainer.find(' .matrix .col').css({ "min-width": "36px", "padding": "0 4px" });
            this.matricesContainer.find(' .matrixContainer .matLabel').css("min-width", "30px");
        }
        this.state = MatricesOutput.STATE_TRANSFORM_SCALE;
    };
    /**Zeigt die Knoten-Einstellungen an falls diese vorher versteckt war*/
    MatricesOutput.prototype.Show = function () {
        if (this.isHide) {
            $(this.target).slideDown('fast');
            this.isHide = false;
        }
    };
    /**Versteckt diese Knoten-Einstellungen falls diese vorher sichtbar war*/
    MatricesOutput.prototype.Hide = function () {
        if (!this.isHide) {
            $(this.target).slideUp('fast');
            this.isHide = true;
        }
    };
    MatricesOutput.STATE_ROOT = "root";
    MatricesOutput.STATE_GEOMETRY = "geom";
    MatricesOutput.STATE_TRANSFORM_TRANSLATION = "translation";
    MatricesOutput.STATE_TRANSFORM_ROTATION = "rotation";
    MatricesOutput.STATE_TRANSFORM_SCALE = "scale";
    return MatricesOutput;
})();
/// <reference path="nodecollectionsdata.ts" />
/// <reference path="view3d.ts" />
/// <reference path="scenegraphconnection.ts" />
/// <reference path="scenegraphnode.ts" />
/// <reference path="nodesettings.ts" />
/// <reference path="scenegraph.ts" />
/// <reference path="matricesoutput.ts" />
/**
*@author  Jarek Sarbiewski
*@requires  JQuery 1.12.0, three.js r73
*/
var App = (function () {
    /** Konstruktor
    *@param  view3DTarget            Ein HTML-DIV-Element indem die 3D-Darstellung gezeichnet werden soll
    *@param  sceneGraphTarget        Ein HTML-DIV-Element indem der Scene-Graph angezeigt werden soll
    *@param  chooseCollectionTarget  Ein HTML-DIV-Element indem die Collection-Auswahlbox angezeigt werden soll
    *@param  nodeSettingsTarget      Ein HTML-DIV-Element indem die Slider zum einstellen der Knoten angezeigt werden sollen
    *@param  matricesOutputTarget    Ein HTML-DIV-Element indem die Matrizen des ausgewählten Knoten angezeigt werden sollen
    *@param  nodeCollectionsXML      Daten für die zu ladenden Knoten und Geometrien die der Anwendung zur Verfügung stehen sollen
    *@param  sceneGraphMode          Interaktionsmodus der Knoten des Scene-Graphen. "moveNode" oder "createConnection" erlaubt. Default:"moveNode"
    */
    function App(view3DTarget, sceneGraphTarget, chooseCollectionTarget, nodeSettingsTarget, matricesOutputTarget, nodeCollectionsXML, sceneGraphMode) {
        var _this = this;
        if (sceneGraphMode === void 0) { sceneGraphMode = "moveNode"; }
        this.view3DTarget = view3DTarget;
        this.sceneGraphTarget = sceneGraphTarget;
        this.chooseCollectionTarget = chooseCollectionTarget;
        this.nodeSettingsTarget = nodeSettingsTarget;
        this.matricesOutputTarget = matricesOutputTarget;
        this.loadData = new NodeCollectionsData(nodeCollectionsXML);
        this.sceneGraphMode = sceneGraphMode;
        this.view3D = new View3D(this.view3DTarget, this.loadData);
        this.sceneGraph = new SceneGraph(this.sceneGraphTarget, this.loadData, this.sceneGraphMode);
        this.nodeSettings = new NodeSettings(this.nodeSettingsTarget, NodeSettings.MODE_TRANSLATION);
        this.matricesOutput = new MatricesOutput(this.matricesOutputTarget);
        this.sceneGraph.onCreateGeometryNode = function (name, id) { _this.OnCreateGeometryNode(name, id); };
        this.sceneGraph.onCreateConnection = function () { _this.OnCreateConnection(); };
        this.sceneGraph.onDeleteGeometryNode = function (geomNodeID) { _this.OnDeleteGeometryNode(geomNodeID); };
        this.sceneGraph.onDeleteTransNodeOrConnection = function () { _this.OnDeleteTransNodeOrConnection(); };
        this.sceneGraph.onSelectConnection = function () { _this.OnSelectConnection(); };
        this.sceneGraph.onSelectGeometryNode = function (matrices, geomNodeID) { _this.OnSelectGeometryNode(matrices, geomNodeID); };
        this.sceneGraph.onSelectRootNode = function () { _this.OnSelectRootNode(); };
        this.sceneGraph.onSelectTransformationNode = function (matrixX, matrixY, matrixZ, matrix, transType) {
            _this.OnSelectTransformationNode(matrixX, matrixY, matrixZ, matrix, transType);
        };
        this.nodeSettings.onChange = function (matrixX, matrixY, matrixZ, matrix, mode) {
            _this.OnChangeNodeSettings(matrixX, matrixY, matrixZ, matrix, mode);
        };
        this.CreateCollectionSelect();
    }
    /**Erstellt Collection-Auswahlbox*/
    App.prototype.CreateCollectionSelect = function () {
        var _this = this;
        var chooseCollection$ = $(this.chooseCollectionTarget).empty().css({ "overflow": "hidden" });
        chooseCollection$.append('<label for="collectionSelect">3D-Model&nbsp;&nbsp;</label>' +
            '<select id="collectionSelect" name="collectionSelect"></select>');
        this.collectionSelect$ = chooseCollection$.find(' #collectionSelect');
        this.collectionSelect$.css({
            "background-color": "#3b4a51",
            "border": "1px solid #577482",
            "color": "white",
            "font-family": "inherit",
            "font-size": "inherit",
            "padding": "1px 5px"
        });
        var colls$ = this.loadData.xml$.find(' nodeCollection');
        for (var i = 0; i < colls$.length; i++) {
            var name = $(colls$[i]).attr('name');
            var title = $(colls$[i]).attr('title');
            this.collectionSelect$.append('<option value="' + name + '" ' + (colls$[i].hasAttribute('selected') ? 'selected="selected"' : '') + ' style="border:none">' + title + '</option>');
        }
        this.collectionSelect$.change(function (e) { _this.OnChangeCollectionSelect(e); });
    };
    /**Wird ausgeführt wenn die Collection-Auswahlbox geändert wird*/
    App.prototype.OnChangeCollectionSelect = function (e) {
        var collName = $(e.delegateTarget).val();
        if (window.confirm('Your current Scene-Graph will be delete!')) {
            this.loadData.ChangeCollection(collName);
            this.view3D.ChangeCollection(collName);
            this.sceneGraph.ChangeCollection(collName);
        }
        else {
            $(e.delegateTarget).val(this.loadData.currCollectionName);
        }
    };
    /**Wird ausgeführt wenn ein neuer Geometrie-Knoten erstellt worden ist*/
    App.prototype.OnCreateGeometryNode = function (name, id) {
        this.view3D.CreateGeometry(name, id);
    };
    /**Wird ausgeführt wenn eine neue Verbindung erstellt wurde*/
    App.prototype.OnCreateConnection = function () {
        this.UpdateAllView3DGeometrys();
        var mats = this.sceneGraph.GetMatricesOfSelectedGeomNode();
        var matrix = new THREE.Matrix4();
        for (var i = 0; i < mats.length; i++) {
            matrix.multiplyMatrices(matrix, mats[i]);
        }
        this.view3D.SetAxisMatrix(matrix);
        if (mats.length > 0)
            this.view3D.SetCamLookPivotY(matrix.elements[13]);
        if (mats.length > 0) {
            var names = this.sceneGraph.GetNodeNamesOfSelectedGeomNode();
            this.matricesOutput.SettingUpGeometry(mats, names);
        }
    };
    /**Wird ausgeführt wenn ein Geometrie-Knoten gelöscht wird*/
    App.prototype.OnDeleteGeometryNode = function (geomNodeID) {
        this.view3D.DeleteGeometry(geomNodeID);
        this.view3D.SetCamLookPivotY(25);
        this.view3D.SetAxisVisibility(false);
        this.nodeSettings.Disable();
        this.nodeSettings.Show();
        this.matricesOutput.Show();
        this.matricesOutput.SettingUpRoot();
    };
    /**Wird ausgeführt wenn ein Transformations-Knoten oder eine Verbindung gelöscht wird*/
    App.prototype.OnDeleteTransNodeOrConnection = function () {
        this.UpdateAllView3DGeometrys();
        this.view3D.SetCamLookPivotY(25);
        this.view3D.SetAxisVisibility(false);
        this.nodeSettings.Disable();
        this.nodeSettings.Show();
        this.matricesOutput.Show();
        this.matricesOutput.SettingUpRoot();
    };
    /**Wird ausgeführt wenn eine Verbindung selektiert wird*/
    App.prototype.OnSelectConnection = function () {
        //this.view3D.SetCamLookPivotY(25);
        this.view3D.SetAxisVisibility(false);
        this.nodeSettings.Disable();
        this.nodeSettings.Show();
        this.matricesOutput.Show();
        this.matricesOutput.SettingUpRoot();
    };
    /**Wird ausgeführt wenn ein Geometrie-Knoten selektiert wird*/
    App.prototype.OnSelectGeometryNode = function (matrices, geomNodeID) {
        var matrix = new THREE.Matrix4();
        for (var i = 0; i < matrices.length; i++) {
            matrix.multiplyMatrices(matrix, matrices[i]);
        }
        this.view3D.SetAxisMatrix(matrix);
        this.view3D.SetCamLookPivotY(matrix.elements[13]);
        this.view3D.SetAxisVisibility(true);
        this.nodeSettings.Disable();
        this.nodeSettings.Show();
        this.matricesOutput.Show();
        this.matricesOutput.SettingUpGeometry(matrices, this.sceneGraph.GetNodeNamesOfSelectedGeomNode());
    };
    /**Wird ausgeführt wenn der Root-Knoten selektiert wird*/
    App.prototype.OnSelectRootNode = function () {
        this.view3D.SetCamLookPivotY(25);
        this.view3D.SetAxisVisibility(false);
        this.nodeSettings.Disable();
        this.nodeSettings.Show();
        this.matricesOutput.Show();
        this.matricesOutput.SettingUpRoot();
    };
    /**Wird ausgeführt wenn ein Transformations-Knoten ausgewählt wird*/
    App.prototype.OnSelectTransformationNode = function (matrixX, matrixY, matrixZ, matrix, transType) {
        //this.view3D.SetCamLookPivotY(25);
        this.view3D.SetAxisVisibility(false);
        this.nodeSettings.SettingUp(matrixX, matrixY, matrixZ, transType);
        this.nodeSettings.Enable();
        this.nodeSettings.Show();
        this.matricesOutput.Show();
        if (transType == "tt")
            this.matricesOutput.SettingUpTranslation(matrixX, matrixY, matrixZ);
        else if (transType == "tr")
            this.matricesOutput.SettingUpRotation(matrixX, matrixY, matrixZ);
        else
            this.matricesOutput.SettingUpScale(matrixX, matrixY, matrixZ);
    };
    /**Wird ausgeführt wenn dich die Einstellungen von NodeSettings geändert haben*/
    App.prototype.OnChangeNodeSettings = function (matrixX, matrixY, matrixZ, matrix, mode) {
        this.sceneGraph.SetMatricesOfSelectedTransNode(matrixX, matrixY, matrixZ, matrix);
        this.UpdateAllView3DGeometrys();
        if (mode == "tt")
            this.matricesOutput.SettingUpTranslation(matrixX, matrixY, matrixZ);
        else if (mode == "tr")
            this.matricesOutput.SettingUpRotation(matrixX, matrixY, matrixZ);
        else
            this.matricesOutput.SettingUpScale(matrixX, matrixY, matrixZ);
    };
    /**Aktualisiert alle Geometrien in der 3D-Ansicht*/
    App.prototype.UpdateAllView3DGeometrys = function () {
        var matricesOfGeomNodes = this.sceneGraph.GetMatricesOfAllGeomNodes();
        for (var i = 0; i < matricesOfGeomNodes.length; i++) {
            var matrix = new THREE.Matrix4();
            var matrices = matricesOfGeomNodes[i].matrices;
            for (var j = 0; j < matrices.length; j++) {
                matrix.multiplyMatrices(matrix, matrices[j]);
            }
            this.view3D.SetGeometryMatrix(matricesOfGeomNodes[i].geomNodeID, matrix);
        }
    };
    /**Setzt den Modus des SceneGraphen. "moveNode" oder "createConnection" sind erlaubt*/
    App.prototype.SetSceneGraphMode = function (mode) {
        console.log("Mode Change to \"" + mode + "\"");
        if (typeof this.sceneGraph != "undefined")
            this.sceneGraph.mode = mode;
        this.sceneGraphMode = mode;
    };
    /**Öffnet und schließt das Knoten-Sortiment*/
    App.prototype.SwitchNodeCollectionVisibility = function () {
        if (typeof this.sceneGraph != "undefined")
            this.sceneGraph.SwitchNodeCollectionVisibility();
    };
    /**Löscht das ausgewählten Element(Node, Connection) aus den Scene-Graphen*/
    App.prototype.DeleteSelectedElement = function () {
        console.log("Selected Element deleted");
        if (typeof this.sceneGraph != "undefined")
            this.sceneGraph.DeleteSelectedElement();
    };
    /**Stellt den Ursprungszustand wieder her*/
    App.prototype.Reset = function () {
        if (window.confirm('Your current Scene-Graph will be delete!')) {
            this.view3D.DeleteAllGeometrys();
            this.view3D.SetCamLookPivotY(25);
            this.sceneGraph.Reset(true);
        }
    };
    /**Speichert den aktuellen Graphen*/
    App.prototype.SaveGraph = function () {
        var blob = new Blob([this.sceneGraph.GetGraphAsXML()], { type: "text/xml;charset=utf-8", endings: "native" });
        var now = (new Date()).toString().split(' ');
        now.pop();
        now.shift();
        saveAs(blob, "SceneGraph - " + this.loadData.currCollectionName + " - " + now.join(' ').split(':').join('_') + ".xml");
    };
    /**Läd einen gespeicherten Graphen*/
    App.prototype.LoadGraph = function (files) {
        var _this = this;
        if (files.length == 1) {
            if (window.confirm("Your current Scene-Graph will be overwrite!")) {
                var file = files[0];
                var fr = new FileReader();
                fr.readAsText(file);
                fr.onload = function (e) { _this.OnLoadGraphComplete(e); };
            }
        }
    };
    /**Wird ausgeführt wenn die XML-Datei des Graphen vollständig geladen wurde*/
    App.prototype.OnLoadGraphComplete = function (e) {
        this.view3D.DeleteAllGeometrys();
        this.view3D.SetAxisVisibility(false);
        this.view3D.SetCamLookPivotY(25);
        this.nodeSettings.Disable();
        this.nodeSettings.Show();
        this.matricesOutput.Show();
        this.matricesOutput.SettingUpRoot();
        var xml$ = $($.parseXML(e.target.result));
        var collName = xml$.find('graph').attr('collectionName');
        if (this.loadData.currCollectionName != collName) {
            this.collectionSelect$.val(collName);
            this.loadData.ChangeCollection(collName);
            this.view3D.ChangeCollection(collName);
            this.sceneGraph.ChangeCollection(collName);
        }
        this.sceneGraph.Reset();
        this.sceneGraph.renderOffset.x = parseInt(xml$.find('graph').attr('offsetX'));
        this.sceneGraph.renderOffset.y = parseInt(xml$.find('graph').attr('offsetY'));
        var nodeIDs = [];
        var nodes$ = xml$.find(' nodes node');
        var cons$ = xml$.find(' connections connection');
        for (var i = 0; i < nodes$.length; i++) {
            var node$ = $(nodes$[i]);
            var id = node$.attr('id');
            var type = node$.attr('type');
            var name = node$.attr('name');
            var posX = node$.attr('posX');
            var posY = node$.attr('posY');
            var pos = new THREE.Vector2(parseFloat(posX), parseFloat(posY));
            var matX = new THREE.Matrix4();
            var matY = new THREE.Matrix4();
            var matZ = new THREE.Matrix4();
            var mat = new THREE.Matrix4();
            var matXArr = node$.find(' matrixX').text().split(',');
            var matYArr = node$.find(' matrixY').text().split(',');
            var matZArr = node$.find(' matrixZ').text().split(',');
            var matArr = node$.find(' matrix').text().split(',');
            for (var j = 0; j < 16; j++) {
                matX.elements[j] = parseFloat(matXArr[j]);
                matY.elements[j] = parseFloat(matYArr[j]);
                matZ.elements[j] = parseFloat(matZArr[j]);
                mat.elements[j] = parseFloat(matArr[j]);
            }
            nodeIDs[id] = this.sceneGraph.CreateNode(name, type, pos, matX, matY, matZ, mat);
        }
        for (var i = 0; i < cons$.length; i++) {
            var con$ = $(cons$[i]);
            this.sceneGraph.CreateConnection(nodeIDs[con$.attr('aNodeID')], nodeIDs[con$.attr('bNodeID')]);
        }
    };
    return App;
})();
//# sourceMappingURL=app.js.map